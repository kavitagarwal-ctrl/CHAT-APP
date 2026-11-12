# Duo Lobby

A small private two-player chat built with Next.js, Neon Postgres, and Vercel. Usernames and passwords only—no email. Includes a one-time recovery key for password resets, encrypted server-side sessions, and a Discord-inspired dark interface with blurple accents, editable profiles, notification preferences, and incoming-message alerts.

## Before you start

- Node.js 20+
- A free Neon project
- A Vercel account / GitHub repository

## 1. Create the Neon database

1. Create a project at [neon.tech](https://neon.tech).
2. Open **SQL Editor**, paste in `db/schema.sql`, and run it.
3. Open **Connect** and copy the pooled connection string. It should look like `postgresql://...neon.tech/...`. If this database already existed, rerun `db/schema.sql` to add the notification preference columns.

## 2. Run locally

```bash
npm install
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local`, then generate a session secret:

```bash
openssl rand -base64 32
```

Paste that output as `SESSION_SECRET` in `.env.local`. Then:

```bash
npm run dev
```

Open `http://localhost:3000`. Create the first account, save the recovery key shown once, and have your friend create the second account. The app stops new signups after two accounts. Usernames are lowercase letters, digits, and underscores (3–20 characters); passwords need at least 10 characters.

## 3. Deploy to Vercel

1. Push this folder's contents to a GitHub repository.
2. Import the repository in Vercel.
3. Add `DATABASE_URL` and a fresh `SESSION_SECRET` under **Project → Settings → Environment Variables** for Production (and Preview if you use it).
4. Deploy. No extra build settings are required.

The `JOIN_CODE` variable is optional. If set, new accounts also need that shared invite code. If you enable it, set `NEXT_PUBLIC_JOIN_CODE_ENABLED=true` in Vercel too to show the invite field in the form. Keep the join code private.

## Password recovery

There is no email-based reset. Signup displays a randomly generated recovery key exactly once; store it somewhere private. To reset, enter the username, key, and a new password. A successful reset rotates the key, so save the newly displayed one too. If the key is lost, the app cannot recover that account—there is intentionally no insecure back door.

## Notes

- Messages refresh every 2.5 seconds; this starter uses polling rather than WebSockets. In-app alerts and optional browser notifications are supported while the site is open. Web Push when the site is fully closed requires additional push-service setup.
- Sessions are encrypted, HTTP-only cookies. Passwords and recovery keys are stored as bcrypt hashes.
- Keep `.env.local` out of Git. Never commit database credentials or `SESSION_SECRET`.
- For public use, add rate limiting to authentication routes before launch.
