import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting Comprehensive Audit & Logging Migration...')

  const tables = [
    `CREATE TABLE IF NOT EXISTS insert_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        farm_id INT4 NOT NULL,
        target_table TEXT NOT NULL,
        record_id INT4 NOT NULL,
        inserted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS delete_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        farm_id INT4 NOT NULL,
        table_name TEXT NOT NULL,
        deleted_data_csv TEXT NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id INT4 NOT NULL,
        attribute_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT NOT NULL,
        farm_id INT4 NOT NULL
    );`
  ];

  const functions = [
    `CREATE OR REPLACE FUNCTION log_insert_fn()
    RETURNS TRIGGER AS $$
    DECLARE
        v_user_id TEXT;
        v_farm_id INT;
    BEGIN
        v_user_id := COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), to_jsonb(NEW)->>'user_id', to_jsonb(NEW)->>'userId', 'system');
        v_farm_id := COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::int, (to_jsonb(NEW)->>'farmId')::int, (to_jsonb(NEW)->>'farm_id')::int, 1);
        
        INSERT INTO insert_logs (user_id, farm_id, target_table, record_id)
        VALUES (v_user_id, v_farm_id, TG_TABLE_NAME, NEW.id);
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`,
    `CREATE OR REPLACE FUNCTION log_delete_fn()
    RETURNS TRIGGER AS $$
    DECLARE
        header TEXT;
        vals TEXT;
        v_user_id TEXT;
        v_farm_id INT;
    BEGIN
        SELECT string_agg(quote_ident(key), '|') INTO header 
        FROM (SELECT key FROM jsonb_each(to_jsonb(OLD)) ORDER BY key) s;
        
        SELECT string_agg(quote_literal(coalesce(value, '')), '|') INTO vals 
        FROM (SELECT value FROM jsonb_each_text(to_jsonb(OLD)) ORDER BY key) s;
        
        v_user_id := COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), to_jsonb(OLD)->>'user_id', to_jsonb(OLD)->>'userId', 'system');
        v_farm_id := COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::int, (to_jsonb(OLD)->>'farmId')::int, (to_jsonb(OLD)->>'farm_id')::int, 1);

        INSERT INTO delete_logs (user_id, farm_id, table_name, deleted_data_csv)
        VALUES (v_user_id, v_farm_id, TG_TABLE_NAME, header || E'\n' || vals);
        RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;`,
    `CREATE OR REPLACE FUNCTION log_update_fn()
    RETURNS TRIGGER AS $$
    DECLARE
        v_user_id TEXT;
        v_farm_id INT;
        col_record RECORD;
        old_val TEXT;
        new_val TEXT;
    BEGIN
        v_user_id := COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), to_jsonb(NEW)->>'user_id', to_jsonb(NEW)->>'userId', 'system');
        v_farm_id := COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::int, (to_jsonb(NEW)->>'farmId')::int, (to_jsonb(NEW)->>'farm_id')::int, 1);
        
        FOR col_record IN 
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = TG_TABLE_NAME 
            AND column_name NOT IN ('id', 'updated_at', 'created_at', 'farm_id', 'user_id', 'userId', 'farmId')
        LOOP
            EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col_record.column_name, col_record.column_name)
            USING OLD, NEW
            INTO old_val, new_val;
            
            IF old_val IS DISTINCT FROM new_val THEN
                INSERT INTO audit_logs (table_name, record_id, attribute_name, old_value, new_value, user_id, farm_id, reason)
                VALUES (TG_TABLE_NAME, NEW.id, col_record.column_name, old_val, new_val, v_user_id, v_farm_id, 'Automatic system audit');
            END IF;
        END LOOP;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`
  ];

  const targetTables = [
    'batches', 'sales', 'expenses', 'inventory', 'daily_feeding_logs', 
    'egg_production', 'mortality', 'weight_records', 'houses', 'customers'
  ];

  const triggers: string[] = [];
  for (const table of targetTables) {
    triggers.push(`DROP TRIGGER IF EXISTS tr_log_insert_${table} ON ${table};`);
    triggers.push(`DROP TRIGGER IF EXISTS tr_log_delete_${table} ON ${table};`);
    triggers.push(`DROP TRIGGER IF EXISTS tr_log_update_${table} ON ${table};`);
    
    triggers.push(`CREATE TRIGGER tr_log_insert_${table} AFTER INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION log_insert_fn();`);
    triggers.push(`CREATE TRIGGER tr_log_delete_${table} BEFORE DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION log_delete_fn();`);
    triggers.push(`CREATE TRIGGER tr_log_update_${table} AFTER UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION log_update_fn();`);
  }

  try {
    for (const sql of [...tables, ...functions, ...triggers]) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('✅ Comprehensive auditing migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
