# HatchLog Desktop Manual Activation (Flutter)

Use this in the Flutter desktop app where the local SQLite `farm_id` and Windows `systemGUID` are available.

## 1) Activation Package UI

- Show combined activation package:
  - `FARM_ID=<local farm_id>`
  - `HARDWARE_ID=<systemGUID>`
- Add **Copy Activation Package** button to copy the full block.

## 2) Cloud Activation Key Verification

Call the web backend after the user enters the single-use activation key from the dashboard:

`POST /api/licenses/device/activate`

```json
{
  "farm_id": "<cloud farm id>",
  "activation_key": "PMS-XXXX-XXXX",
  "hardware_id": "<systemGUID>",
  "device_name": "Office Desktop",
  "device_type": "Desktop"
}
```

Successful responses include:

```json
{
  "success": true,
  "confirmation_code": "PMS-CONF-XXXXXXXXXX",
  "registration_id": "...",
  "farm_id": "...",
  "hardware_id": "...",
  "license_status": "CLOUD_TRIAL",
  "license_expires_at": "2026-06-27T00:00:00.000Z",
  "next_step": "CREATE_LOCAL_LOGIN"
}
```

On success, create the local login and persist the returned license metadata.

## 3) Deterministic Token Validation

- Token formula must match backend:
  - payload = `hatchlog-manual-v1:{HARDWARE_ID_NORMALIZED}:{FARM_ID_NORMALIZED}:{EXPIRY_ISO}`
  - digest = `HMAC_SHA256(payload, HATCHLOG_LICENSE_TOKEN_SECRET)`
  - readable body = first 16 base32-like chars using alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, grouped in blocks of 4.
  - token = `HL-{durationDays}D-{groupedBody}`

Use `docs/flutter/manual_license_validator.dart` as the implementation source.

## 4) Persist Local Access

On successful validation, write to SQLite token config store:
- `activation_token`
- `hardware_id`
- `farm_id`
- `expires_at`
- `is_active=true`

Then permit dashboard entry.
