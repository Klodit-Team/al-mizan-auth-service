# OTP Integration Guide (Frontend)

This guide explains how OTP works with registration and how a frontend should integrate with the flow.

## ✅ Flow Summary

1. **Register** user via `POST /api/v1/auth/register`.
2. **Send OTP** via `POST /otp/send` (email required).
3. User receives OTP by email (valid 10 minutes).
4. **Verify OTP** via `POST /otp/verify` (email + code).
5. When OTP is valid, the backend sets `user.isActive = true`.
6. **Login** after activation via `POST /api/v1/auth/login`.

> ⚠️ OTP is stored **in memory** (Map). If the service restarts, codes are lost.

---

## Endpoints

### 1) Register
`POST /api/v1/auth/register`

**Purpose**: Create a user (inactive by default).

**Request (example)**
```json
{
  "email": "user@example.com",
  "password": "MyPassword123",
  "role": "SERVICE_CONTRACTANT",
  "nom": "Benali",
  "prenom": "Ahmed",
  "denomination": "Ministère des Finances",
  "type": "MINISTERE"
}
```

**Success Response**
```json
{
  "message": "Account created. Verify your email.",
  "user_id": "uuid-xxxx"
}
```

---

### 2) Send OTP
`POST /otp/send`

**Purpose**: Send OTP to user email.

**Request**
```json
{ "email": "user@example.com" }
```

**Success Response**
```json
{
  "success": true,
  "message": "Code OTP envoyé à user@example.com"
}
```

---

### 3) Verify OTP
`POST /otp/verify`

**Purpose**: Validate OTP and activate account (`isActive = true`).

**Request**
```json
{ "email": "user@example.com", "code": "123456" }
```

**Success Response**
```json
{ "success": true, "message": "Authentification réussie !" }
```

**Failure Response**
```json
{ "success": false, "message": "Code incorrect." }
```

---

## Login After Activation

`POST /api/v1/auth/login`

If the account isn’t activated, backend **should** respond:
```json
{ "message": "Account not activated. Check your email for the OTP code." }
```

---

## Notes for Frontend

- **OTP expiry**: 10 minutes.
- **OTP format**: 6 digits.
- OTP is **one-time**: after success, it is deleted.
- Because OTP store is in-memory, avoid relying on OTP after backend restart.

---

## Suggested UI Flow

1. Register form → call `/api/v1/auth/register`
2. After success, show OTP screen
3. Call `/otp/send`
4. User enters code → call `/otp/verify`
5. On success, redirect to login

---

If you need sample axios/fetch snippets or error mapping, ask and I’ll add it.
