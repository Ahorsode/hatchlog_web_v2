import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

function run(command, { allowFailure = false } = {}) {
  try {
    const output = execSync(command, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, output };
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`;
    if (allowFailure) {
      return { ok: false, output };
    }
    throw new Error(output || `Command failed: ${command}`);
  }
}

function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => statSync(join(MIGRATIONS_DIR, name)).isDirectory())
    .sort();
}

function needsBaseline(output) {
  return (
    output.includes("P3018") ||
    output.includes("P3009") ||
    output.includes("already exists") ||
    output.includes("failed migrations in the target database")
  );
}

function baselineExistingDatabase() {
  const migrations = listMigrations();
  console.log(
    `[prisma-deploy] Baselining ${migrations.length} migrations (schema already exists in production)`,
  );

  for (const migration of migrations) {
    const result = run(`npx prisma migrate resolve --applied ${migration}`, {
      allowFailure: true,
    });
    if (result.ok) {
      console.log(`[prisma-deploy] Marked applied: ${migration}`);
    }
  }
}

function migrateDeploy() {
  return run("npx prisma migrate deploy", { allowFailure: true });
}

const firstAttempt = migrateDeploy();
if (firstAttempt.ok) {
  console.log("[prisma-deploy] Migrations up to date");
  process.exit(0);
}

if (!needsBaseline(firstAttempt.output)) {
  throw new Error(firstAttempt.output || "prisma migrate deploy failed");
}

console.log("[prisma-deploy] Detected unbaselined or failed migration history");
baselineExistingDatabase();

const secondAttempt = migrateDeploy();
if (!secondAttempt.ok) {
  throw new Error(secondAttempt.output || "prisma migrate deploy failed after baseline");
}

console.log("[prisma-deploy] Migrations applied successfully after baseline");
