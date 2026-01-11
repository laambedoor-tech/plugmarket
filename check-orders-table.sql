-- Check orders table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- Check recent orders
SELECT id, customer_email, payment_method, payment_status, created_at, products
FROM orders
ORDER BY created_at DESC
LIMIT 5;
