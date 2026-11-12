import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username: rawUsername, recoveryCode, newPassword } = await request.json();
    const username = typeof rawUsername === "string" ? rawUsername.trim().toLowerCase() : "";
    if (typeof newPassword !== "string" || newPassword.length < 10 || newPassword.length > 72) {
      return NextResponse.json({ error: "New password must be between 10 and 72 characters." }, { status: 400 });
    }
    const rows = await sql`SELECT id, recovery_hash FROM users WHERE username = ${username} LIMIT 1`;
    if (!rows.length || !rows[0].recovery_hash || typeof recoveryCode !== "string" || !await bcrypt.compare(recoveryCode.trim().toUpperCase(), String(rows[0].recovery_hash))) {
      return NextResponse.json({ error: "Username or recovery code is incorrect." }, { status: 401 });
    }
    const nextCode = randomBytes(12).toString("hex").toUpperCase();
    const [passwordHash, recoveryHash] = await Promise.all([bcrypt.hash(newPassword, 12), bcrypt.hash(nextCode, 10)]);
    await sql`UPDATE users SET password_hash = ${passwordHash}, recovery_hash = ${recoveryHash} WHERE id = ${Number(rows[0].id)}`;
    return NextResponse.json({ ok: true, recoveryCode: nextCode });
  } catch (error) {
    console.error("Password reset failed", error);
    return NextResponse.json({ error: "Could not reset your password. Try again." }, { status: 500 });
  }
}
