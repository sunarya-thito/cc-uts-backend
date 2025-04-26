export interface Product {
  id: string
  name: string
  price: number
  image: string
  imageKey?: string // Added for internal use
  dateAdded: string
  dateUpdated: string
}

export interface ProductInput {
  name: string
  price: number
  image: string
}

export interface ProductUpdateInput {
  name: string,
  price: number,
  image?: string | null,
}
