-- Add status change reason column
ALTER TABLE trucking.invoices
ADD COLUMN IF NOT EXISTS status_change_reason TEXT;

-- Add bank and payment details if not exists
ALTER TABLE trucking.invoices
ADD COLUMN IF NOT EXISTS bank_details TEXT,
ADD COLUMN IF NOT EXISTS payment_details TEXT;
