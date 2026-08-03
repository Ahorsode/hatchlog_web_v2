CREATE TABLE "admin_user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_user_username_key" ON "admin_user"("username");
CREATE INDEX "manual_license_payments_admin_user_id_idx" ON "manual_license_payments"("admin_user_id");

INSERT INTO "admin_user" ("id", "username", "password_hash", "is_active")
VALUES (
    'admin_ahorsode',
    'Ahorsode',
    '$2b$12$HDEqYCHTFOjIVBl0mSRfrOksbEBvlD4i4nz1GwyQY3NOoazmJMtiS',
    true
)
ON CONFLICT ("username") DO UPDATE SET
    "password_hash" = EXCLUDED."password_hash",
    "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP;

ALTER TABLE "manual_license_payments"
ADD CONSTRAINT "manual_license_payments_admin_user_id_fkey"
FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
