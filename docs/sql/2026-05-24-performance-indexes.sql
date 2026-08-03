-- Web Performance Hardening v1
-- Apply manually in Supabase SQL editor (CONCURRENTLY cannot run inside txn-wrapped migration runners).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mortality_farm_type_logdate
ON "mortality" ("farmId", "type", "logDate");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_egg_production_farm_logdate
ON "egg_production" ("farmId", "logDate");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feeding_logs_farm_logdate
ON "daily_feeding_logs" ("farmId", "logDate");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_farm_saledate_active
ON "sales" ("farmId", "saleDate")
WHERE "is_deleted" = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_farm_orderdate_active
ON "orders" ("farmId", "orderDate")
WHERE "is_deleted" = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_farm_category_stock
ON "inventory" ("farmId", "category", "stockLevel");
