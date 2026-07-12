ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS order_nsu          text UNIQUE,
  ADD COLUMN IF NOT EXISTS checkout_url       text,
  ADD COLUMN IF NOT EXISTS ip_slug            text,
  ADD COLUMN IF NOT EXISTS ip_transaction_nsu text,
  ADD COLUMN IF NOT EXISTS ip_capture_method  text,
  ADD COLUMN IF NOT EXISTS ip_receipt_url     text;
