-- Drop existing trigger
DROP TRIGGER IF EXISTS balance_transaction_trigger ON balance_transactions;

-- Recreate the trigger
CREATE TRIGGER balance_transaction_trigger
AFTER INSERT ON balance_transactions
FOR EACH ROW
EXECUTE FUNCTION update_user_balance();

-- Add your $10 topup manually (replace 'wezkob@gmail.com' with your actual email if different)
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
  'Balance top-up via Stripe (manual correction)',
  'stripe',
  'pi_manual_correction'
);

-- Verify your balance
SELECT email, balance FROM users WHERE email = 'wezkob@gmail.com';
