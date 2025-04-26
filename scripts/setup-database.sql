-- Create products table with image_key column instead of image URL
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_key VARCHAR(512),
  date_added TIMESTAMP NOT NULL DEFAULT NOW(),
  date_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_date_added ON products(date_added);

-- Insert sample data (without actual S3 keys - you'll need to upload these images)
INSERT INTO products (name, price, date_added, date_updated)
VALUES 
  ('Wireless Headphones', 99.99, NOW(), NOW()),
  ('Smart Watch', 199.99, NOW(), NOW()),
  ('Bluetooth Speaker', 79.99, NOW(), NOW()),
  ('Mechanical Keyboard', 129.99, NOW(), NOW());
