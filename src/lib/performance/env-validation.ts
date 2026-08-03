function isSupabasePoolerUrl(url: string) {
  return url.includes(".pooler.supabase.com:6543");
}

function hasPgBouncerFlag(url: string) {
  return /[?&]pgbouncer=true(?:&|$)/.test(url);
}

function hasDirect5432(url: string) {
  return /:5432(?:\/|\?|$)/.test(url);
}

export function validateDatabaseRuntimeConfig() {
  if (process.env.NODE_ENV !== "production") return;

  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in production");
  }

  if (!isSupabasePoolerUrl(databaseUrl) || !hasPgBouncerFlag(databaseUrl)) {
    throw new Error(
      "DATABASE_URL must use Supabase Supavisor transaction pooler (:6543) and include pgbouncer=true in production",
    );
  }

  if (databaseUrl.includes(".supabase.co:5432")) {
    throw new Error("DATABASE_URL must not use a direct PostgreSQL host/port in production");
  }

  if (directUrl && !hasDirect5432(directUrl)) {
    throw new Error("DIRECT_URL should point to a direct 5432 connection for Prisma CLI workflows");
  }
}

