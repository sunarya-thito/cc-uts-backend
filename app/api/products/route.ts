import { NextResponse } from "next/server"
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
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

// GET /api/products
export async function GET() {
  try {
    const result = await db.query(`
      SELECT 
        id::text, 
        name, 
        price, 
        image_key as "imageKey", 
        date_added as "dateAdded", 
        date_updated as "dateUpdated" 
      FROM products 
      ORDER BY date_added DESC
    `)

    // Generate presigned URLs for all product images
    const products = await Promise.all(
      result.rows.map(async (product) => {
        if (product.imageKey) {
          const url = await generateImageUrl(product.imageKey)
          return {
            ...product,
            image: url,
          }
        }
        return product
      }),
    )

    return NextResponse.json(products)
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json({ message: "Failed to fetch products" }, { status: 500 })
  }
}

// POST /api/products
export async function POST(request: Request) {
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

    let imageKey: string | null = null
    let s3ImageUrl: string | null = null

    // Handle image upload if a file was provided
    if (imageFile) {
      // Generate a unique key for the file
      const fileExtension = imageFile.name.split(".").pop() || "jpg"
      imageKey = `products/${uuidv4()}.${fileExtension}`

      // Upload the file to S3 (without public ACL)
      const buffer = Buffer.from(await imageFile.arrayBuffer())

      const putCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: imageKey,
        Body: buffer,
        ContentType: imageFile.type,
        ACL: "public-read",
      })

      await s3Client.send(putCommand)

      // Generate a presigned URL for the uploaded image
      s3ImageUrl = await generateImageUrl(imageKey)
    } else if (imageUrl) {
      // For external URLs, we don't need to generate a presigned URL
      s3ImageUrl = imageUrl
    } else {
      return NextResponse.json({ message: "Image is required" }, { status: 400 })
    }

    // Insert the product into the database
    const result = await db.query(
      `
      INSERT INTO products (name, price, image_key, date_added, date_updated)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING 
        id::text, 
        name, 
        price, 
        image_key as "imageKey", 
        date_added as "dateAdded", 
        date_updated as "dateUpdated"
      `,
      [name, price, imageKey],
    )

    const newProduct = result.rows[0]

    // Return the product with the presigned URL
    return NextResponse.json(
      {
        ...newProduct,
        image: s3ImageUrl,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error creating product:", error)
    return NextResponse.json({ message: "Failed to create product" }, { status: 500 })
  }
}
