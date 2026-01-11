-- Check if balance column exists in users table
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users';

-- Check user data
SELECT * FROM users WHERE email = 'wezkob@gmail.com';

-- Check transactions
SELECT * FROM balance_transactions WHERE user_email = 'wezkob@gmail.com';
