-- First, check if balance column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'balance';

-- Add balance column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00;

-- Verify the user exists and show their balance
SELECT email, balance, created_at FROM users WHERE email = 'wezkob@gmail.com';

-- If user doesn't have balance set, update it
UPDATE users SET balance = 0.00 WHERE email = 'wezkob@gmail.com' AND balance IS NULL;

-- Drop existing trigger
DROP TRIGGER IF EXISTS balance_transaction_trigger ON balance_transactions;

-- Recreate the trigger
CREATE TRIGGER balance_transaction_trigger
AFTER INSERT ON balance_transactions
FOR EACH ROW
EXECUTE FUNCTION update_user_balance();

-- Add your $10 topup
INSERT INTO balance_transactions (
  user_email,
  type,
  amount,
  description,
  payment_method,
  payment_intent_id
) VALUES (
  'wezkob@gmail.com',
  'topup',
  10.00,
  'Balance top-up via Stripe',
  'stripe',
  'pi_manual_correction'
) ON CONFLICT DO NOTHING;

-- Final verification
SELECT email, balance FROM users WHERE email = 'wezkob@gmail.com';
