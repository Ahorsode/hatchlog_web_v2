-- Inventory items (vaccines/medicines) can declare how they are used:
-- a one-time application vs. quantity-tracked stock.
ALTER TABLE "inventory"
  ADD COLUMN IF NOT EXISTS "usageType" TEXT;
