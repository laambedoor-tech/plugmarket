-- Create reviews table in Supabase
-- Execute this SQL in your Supabase dashboard under SQL Editor

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name VARCHAR(40),
  product VARCHAR(50) NOT NULL,
  stars SMALLINT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  message TEXT NOT NULL,
  order_id VARCHAR(30),
  user_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date VARCHAR(20)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(product);

-- Enable RLS (Row Level Security) - Allow public read
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read reviews
CREATE POLICY "Allow public read" ON reviews
  FOR SELECT USING (true);

-- Allow anyone to insert reviews
CREATE POLICY "Allow public insert" ON reviews
  FOR INSERT WITH CHECK (true);
