# Product Management Application with AWS Integration

A CRUD application for managing products with AWS RDS, EC2, and S3 integration.

## Features

- View products in grid or list view
- Sort products by name, price, date added, or date updated
- Search products by name
- Create, update, and delete products
- Secure image storage in AWS S3 with presigned URLs
- Store product data in AWS RDS (PostgreSQL)
- Responsive design with dark theme

## AWS Architecture

This application uses the following AWS services:

- **RDS (PostgreSQL)**: Stores product data
- **S3**: Securely stores product images (private objects with presigned URLs)
- **EC2**: Hosts the backend API

## Security Features

- S3 objects are kept private (no public ACL)
- Presigned URLs are generated for temporary access to images
- Database credentials are securely stored in environment variables
- AWS credentials are only used on the server side

## Getting Started

1. Clone the repository
2. Install dependencies:
   \`\`\`
   npm install
   \`\`\`
3. Copy the environment variables:
   \`\`\`
   cp .env.example .env.local
   \`\`\`
4. Set up your AWS resources:
   - Create an S3 bucket for product images
   - Set up an RDS PostgreSQL instance
   - Configure an EC2 instance for the backend API
5. Update your environment variables with your AWS and database credentials
6. Run the database setup script:
   \`\`\`
   psql -h your-rds-host -U your-username -d your-database -f scripts/setup-database.sql
   \`\`\`
7. Start the development server:
   \`\`\`
   npm run dev
   \`\`\`

## Environment Variables

- `NEXT_PUBLIC_API_URL`: The URL of your backend API
- `AWS_REGION`: Your AWS region
- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_S3_BUCKET_NAME`: Your S3 bucket name
- `DB_USER`: PostgreSQL username
- `DB_HOST`: RDS instance hostname
- `DB_NAME`: Database name
- `DB_PASSWORD`: Database password
- `DB_PORT`: Database port (usually 5432)

## Product Service Implementations

This application supports multiple product service implementations:

1. **Dummy Service**: In-memory implementation with simulated network delays
2. **LocalStorage Service**: Implementation that stores products in browser localStorage
3. **API Service**: Implementation that fetches data from a backend API

To switch between implementations, edit the `IMPLEMENTATION` constant in `lib/product-service-provider.ts`:

\`\`\`typescript
// Options: "dummy", "localStorage", "api"
const IMPLEMENTATION = "api"
\`\`\`

## How Presigned URLs Work

Instead of making S3 objects publicly accessible, this application:

1. Stores objects in S3 with private access
2. Stores the S3 object key in the database
3. Generates temporary presigned URLs when retrieving products
4. Returns these presigned URLs to the client for image display

This approach is more secure as it:
- Prevents unauthorized access to your S3 objects
- Limits access to specific time periods
- Allows you to revoke access by deleting or replacing the object

## License

MIT
