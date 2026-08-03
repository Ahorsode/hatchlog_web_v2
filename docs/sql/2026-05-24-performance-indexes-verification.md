# Index Verification Checklist

Run each query before and after applying [2026-05-24-performance-indexes.sql](/C:/Users/ahors/hosting_pfms/poultry-pms/docs/sql/2026-05-24-performance-indexes.sql) and capture output.

## 1) Mortality by farm/type/date

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "logDate", "count"
FROM "mortality"
WHERE "farmId" = '<farm-id>'
  AND "type" = 'DEAD'
  AND "logDate" >= NOW() - INTERVAL '30 days'
ORDER BY "logDate" DESC
LIMIT 200;
```

## 2) Egg production timeline

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "logDate", "eggsCollected"
FROM "egg_production"
WHERE "farmId" = '<farm-id>'
  AND "logDate" >= NOW() - INTERVAL '30 days'
ORDER BY "logDate" ASC;
```

## 3) Feeding log timeline

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "logDate", "amountConsumed"
FROM "daily_feeding_logs"
WHERE "farmId" = '<farm-id>'
  AND "logDate" >= NOW() - INTERVAL '30 days'
ORDER BY "logDate" ASC;
```

## 4) Sales recent history

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "saleDate", "totalAmount"
FROM "sales"
WHERE "farmId" = '<farm-id>'
  AND "is_deleted" = false
  AND "saleDate" >= NOW() - INTERVAL '30 days'
ORDER BY "saleDate" DESC;
```

## 5) Orders recent history

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "orderDate", "totalAmount"
FROM "orders"
WHERE "farmId" = '<farm-id>'
  AND "is_deleted" = false
  AND "orderDate" >= NOW() - INTERVAL '30 days'
ORDER BY "orderDate" DESC;
```

## 6) Low-stock inventory scan

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "itemName", "stockLevel"
FROM "inventory"
WHERE "farmId" = '<farm-id>'
  AND "category" = 'FEED'
  AND "stockLevel" < 500
ORDER BY "stockLevel" ASC;
```

## Pass Criteria

- Query plans show index scan/bitmap index scan instead of sequential scan on target predicates.
- Latency and shared buffer reads decrease materially on high-cardinality farms.
