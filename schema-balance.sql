-- Add balance column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00;

-- Create balance_transactions table for transaction history
CREATE TABLE IF NOT EXISTS balance_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topup', 'purchase', 'refund')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  payment_method TEXT,
  payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_balance_transactions_user_email ON balance_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_created_at ON balance_transactions(created_at DESC);

-- Update balance after transaction (trigger)
CREATE OR REPLACE FUNCTION update_user_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'topup' OR NEW.type = 'refund' THEN
    UPDATE users SET balance = balance + NEW.amount WHERE email = NEW.user_email;
  ELSIF NEW.type = 'purchase' THEN
    UPDATE users SET balance = balance - NEW.amount WHERE email = NEW.user_email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER balance_transaction_trigger
AFTER INSERT ON balance_transactions
FOR EACH ROW
EXECUTE FUNCTION update_user_balance();
