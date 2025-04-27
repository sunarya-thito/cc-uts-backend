import { NextResponse } from "next/server"
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from "uuid"
import { db } from "@/lib/db"

// Initialize the S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

async function generateImageUrl(key: string) {
  return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

// GET /api/products/[id]
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  try {
    const result = await db.query(
      `
      SELECT 
        id::text, 
        name, 
        price, 
        image_key as "imageKey", 
        date_added as "dateAdded", 
        date_updated as "dateUpdated" 
      FROM products 
      WHERE id = $1
      `,
      [id],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 })
    }

    const product = result.rows[0]

    // Generate a presigned URL for the product image
    if (product.imageKey) {
      product.image = await generateImageUrl(product.imageKey)
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error(`Error fetching product with ID ${id}:`, error)
    return NextResponse.json({ message: "Failed to fetch product" }, { status: 500 })
  }
}

// PUT /api/products/[id]
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  try {
    // Parse the multipart form data
    const formData = await request.formData()
    const name = formData.get("name") as string
    const price = Number.parseFloat(formData.get("price") as string)
    const imageFile = formData.get("image") as File | null
    const imageUrl = formData.get("imageUrl") as string | null

    // Validate required fields
    if (!name || isNaN(price)) {
      return NextResponse.json({ message: "Name and price are required" }, { status: 400 })
    }

    // Get the current product to check if we need to delete an old image
    const currentProduct = await db.query('SELECT image_key as "imageKey" FROM products WHERE id = $1', [id])

    if (currentProduct.rows.length === 0) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 })
    }

    let imageKey = currentProduct.rows[0].imageKey
    let s3ImageUrl: string | null = null

    // Handle image upload if a file was provided
    if (imageFile) {
      // Generate a unique key for the file
      const fileExtension = imageFile.name.split(".").pop() || "jpg"
      const newImageKey = `products/${uuidv4()}.${fileExtension}`

      // Upload the file to S3 (without public ACL)
      const buffer = Buffer.from(await imageFile.arrayBuffer())

      const putCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: newImageKey,
        Body: buffer,
        ContentType: imageFile.type,
        ACL: "public-read",
      })

      await s3Client.send(putCommand)

      // Delete the old image if it exists
      if (imageKey) {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME!,
            Key: imageKey,
          })

          await s3Client.send(deleteCommand)
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError)
          // Continue with the update even if deletion fails
        }
      }

      // Update the image key
      imageKey = newImageKey

      // Generate a presigned URL for the new image
      s3ImageUrl = await generateImageUrl(newImageKey)
    } else if (imageUrl) {
      s3ImageUrl = imageUrl
      imageKey = null // Clear the S3 key since we're using an external URL
    } else if (imageKey) {
      s3ImageUrl = await generateImageUrl(imageKey)
    }

    // Update the product in the database
    const result = await db.query(
      `
      UPDATE products 
      SET name = $1, price = $2, image_key = $3, date_updated = NOW()
      WHERE id = $4
      RETURNING 
        id::text, 
        name, 
        price, 
        image_key as "imageKey", 
        date_added as "dateAdded", 
        date_updated as "dateUpdated"
      `,
      [name, price, imageKey, id],
    )

    const updatedProduct = result.rows[0]

    // Return the product with the presigned URL
    return NextResponse.json({
      ...updatedProduct,
      image: s3ImageUrl
    })
  } catch (error) {
    console.error(`Error updating product with ID ${id}:`, error)
    return NextResponse.json({ message: "Failed to update product" }, { status: 500 })
  }
}

// DELETE /api/products/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  try {
    // Get the product image key before deleting
    const product = await db.query('SELECT image_key as "imageKey" FROM products WHERE id = $1', [id])

    if (product.rows.length === 0) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 })
    }

    // Delete the product from the database
    await db.query("DELETE FROM products WHERE id = $1", [id])

    // Delete the image from S3 if it exists
    const imageKey = product.rows[0].imageKey
    if (imageKey) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME!,
          Key: imageKey,
        })

        await s3Client.send(deleteCommand)
      } catch (deleteError) {
        console.error("Error deleting image:", deleteError)
        // Continue with the response even if deletion fails
      }
    }

    // Return 204 No Content for successful deletion
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error(`Error deleting product with ID ${id}:`, error)
    return NextResponse.json({ message: "Failed to delete product" }, { status: 500 })
  }
}
