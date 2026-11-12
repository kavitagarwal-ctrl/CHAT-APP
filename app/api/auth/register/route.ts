import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username: rawUsername, password, inviteCode } = await request.json();
    const username = typeof rawUsername === "string" ? rawUsername.trim().toLowerCase() : "";
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: "Username must be 3–20 characters: letters, numbers, or underscores." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 10 || password.length > 72) {
      return NextResponse.json({ error: "Password must be between 10 and 72 characters." }, { status: 400 });
    }
    if (process.env.JOIN_CODE && inviteCode !== process.env.JOIN_CODE) {
      return NextResponse.json({ error: "That invite code is not correct." }, { status: 403 });
    }
    const count = await sql`SELECT COUNT(*)::int AS total FROM users`;
    if (Number(count[0]?.total ?? 0) >= 2) {
      return NextResponse.json({ error: "This private lobby already has its two accounts." }, { status: 403 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const recoveryCode = randomBytes(12).toString("hex").toUpperCase();
    const recoveryHash = await bcrypt.hash(recoveryCode, 10);
    const rows = await sql`
      INSERT INTO users (username, password_hash, recovery_hash)
      VALUES (${username}, ${passwordHash}, ${recoveryHash})
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username
    `;
    if (!rows.length) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    const session = await getSession();
    session.userId = Number(rows[0].id);
    session.username = String(rows[0].username);
    await session.save();
    return NextResponse.json({ user: { id: Number(rows[0].id), username }, recoveryCode });
  } catch (error) {
    console.error("Register failed", error);
    return NextResponse.json({ error: "Could not create the account. Check your setup and try again." }, { status: 500 });
  }
}
