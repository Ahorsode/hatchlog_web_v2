CREATE TABLE IF NOT EXISTS "expense_allocations" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "expense_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "farm_id" TEXT NOT NULL,
  "allocated_amount" DECIMAL(15, 2) NOT NULL,
  "allocation_percentage" DECIMAL(7, 4),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_allocations_expense_id_batch_id_key"
  ON "expense_allocations"("expense_id", "batch_id");

CREATE INDEX IF NOT EXISTS "expense_allocations_batch_id_idx"
  ON "expense_allocations"("batch_id");

CREATE INDEX IF NOT EXISTS "expense_allocations_farm_id_idx"
  ON "expense_allocations"("farm_id");

CREATE INDEX IF NOT EXISTS "expense_allocations_expense_id_idx"
  ON "expense_allocations"("expense_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expense_allocations_expense_id_fkey'
  ) THEN
    ALTER TABLE "expense_allocations"
      ADD CONSTRAINT "expense_allocations_expense_id_fkey"
      FOREIGN KEY ("expense_id") REFERENCES "expenses"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expense_allocations_batch_id_fkey'
  ) THEN
    ALTER TABLE "expense_allocations"
      ADD CONSTRAINT "expense_allocations_batch_id_fkey"
      FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expense_allocations_farm_id_fkey'
  ) THEN
    ALTER TABLE "expense_allocations"
      ADD CONSTRAINT "expense_allocations_farm_id_fkey"
      FOREIGN KEY ("farm_id") REFERENCES "farms"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "expense_allocations" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polname = 'expense_allocations_farm_isolation_policy'
      AND polrelid = '"expense_allocations"'::regclass
  ) THEN
    CREATE POLICY "expense_allocations_farm_isolation_policy"
      ON "expense_allocations"
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM "farms"
          WHERE "farms"."id" = "expense_allocations"."farm_id"
            AND "farms"."userId" = current_setting('app.current_user_id', true)
        )
        OR EXISTS (
          SELECT 1
          FROM "farm_members"
          WHERE "farm_members"."farmId" = "expense_allocations"."farm_id"
            AND "farm_members"."userId" = current_setting('app.current_user_id', true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM "farms"
          WHERE "farms"."id" = "expense_allocations"."farm_id"
            AND "farms"."userId" = current_setting('app.current_user_id', true)
        )
        OR EXISTS (
          SELECT 1
          FROM "farm_members"
          WHERE "farm_members"."farmId" = "expense_allocations"."farm_id"
            AND "farm_members"."userId" = current_setting('app.current_user_id', true)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT ON TABLE "expense_allocations" TO authenticated;
  END IF;
END $$;
