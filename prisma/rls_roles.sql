-- BLOCK
-- Helper function to get current application user ID
CREATE OR REPLACE FUNCTION current_app_user() 
RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', true);
$$ LANGUAGE sql STABLE;

-- BLOCK
-- Helper function to check farm membership
CREATE OR REPLACE FUNCTION is_farm_member(_farm_id INTEGER, _user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "farms" f WHERE f.id = _farm_id AND f."userId" = _user_id
  ) OR EXISTS (
    SELECT 1 FROM "farm_members" fm WHERE fm."farmId" = _farm_id AND fm."userId" = _user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- BLOCK
-- Update Farm Isolation Policy
DROP POLICY IF EXISTS farm_isolation_policy ON "farms";
CREATE POLICY farm_isolation_policy ON "farms" 
  FOR ALL USING (
    "userId" = current_app_user() OR
    EXISTS (
      SELECT 1 FROM "farm_members" fm 
      WHERE fm."farmId" = "farms".id AND fm."userId" = current_app_user()
    )
  );

-- BLOCK
-- Update House Isolation Policy
DROP POLICY IF EXISTS house_isolation_policy ON "houses";
CREATE POLICY house_isolation_policy ON "houses" 
  FOR ALL USING (
    is_farm_member("farmId", current_app_user())
  );

-- BLOCK
-- Update Batch Isolation Policy
DROP POLICY IF EXISTS batch_isolation_policy ON "batches";
CREATE POLICY batch_isolation_policy ON "batches" 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "houses" ph 
      WHERE ph.id = "batches"."houseId" AND is_farm_member(ph."farmId", current_app_user())
    )
  );

-- BLOCK
-- Update Egg Production Policy
DROP POLICY IF EXISTS egg_prod_select_policy ON "egg_production";
CREATE POLICY egg_prod_select_policy ON "egg_production"
  FOR SELECT USING (
    is_farm_member("farmId", current_app_user())
    OR EXISTS (
      SELECT 1 FROM "farms" f
      WHERE f.id = "egg_production"."farmId"
        AND f."userId" = current_app_user()
    )
  );

-- BLOCK
CREATE POLICY egg_prod_insert_policy ON "egg_production"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "batches" b
      JOIN "houses" ph ON b."houseId" = ph.id
      WHERE b.id = "egg_production"."batchId" 
      AND is_farm_member(ph."farmId", current_app_user())
    )
  );

-- BLOCK
-- Update Mortality Policy
DROP POLICY IF EXISTS mortality_isolation_policy ON "mortality";
CREATE POLICY mortality_isolation_policy ON "mortality" 
  FOR ALL USING (
    is_farm_member((SELECT "farmId" FROM "houses" JOIN "batches" ON "houses".id = "batches"."houseId" WHERE "batches".id = "mortality"."batchId"), current_app_user())
  );

-- BLOCK
-- Update Sales Policy
DROP POLICY IF EXISTS sales_isolation_policy ON "sales";
CREATE POLICY sales_isolation_policy ON "sales" 
  FOR SELECT USING (
    is_farm_member("farmId", current_app_user())
    OR EXISTS (
      SELECT 1 FROM "farms" f
      WHERE f.id = "sales"."farmId"
        AND f."userId" = current_app_user()
    )
  );

-- BLOCK
-- Update Inventory Policy
DROP POLICY IF EXISTS inventory_isolation_policy ON "inventory";
CREATE POLICY inventory_isolation_policy ON "inventory" 
  FOR ALL USING (
    "userId" = current_app_user() OR
    EXISTS (
      SELECT 1 FROM "users" u 
      WHERE u.id = current_app_user() 
      AND u.role IN ('OWNER', 'MANAGER')
      AND EXISTS (
          SELECT 1 FROM "farms" f WHERE f."userId" = "inventory"."userId"
      )
    )
  );

-- BLOCK
-- Update Weight Records Policy
DROP POLICY IF EXISTS weight_isolation_policy ON "weight_records";
CREATE POLICY weight_isolation_policy ON "weight_records" 
  FOR ALL USING (
    is_farm_member((SELECT "farmId" FROM "houses" JOIN "batches" ON "houses".id = "batches"."houseId" WHERE "batches".id = "weight_records"."batchId"), current_app_user())
  );
