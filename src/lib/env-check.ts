const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
];

export function validateEnv() {
  // CI builds inject placeholder-safe behavior through this explicit bypass.
  if (process.env.SKIP_ENV_VALIDATION === "true") return;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
