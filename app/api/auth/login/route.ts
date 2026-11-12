import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username: rawUsername, password } = await request.json();
    const username = typeof rawUsername === "string" ? rawUsername.trim().toLowerCase() : "";
    const rows = await sql`SELECT id, username, password_hash FROM users WHERE username = ${username} LIMIT 1`;
    const valid = rows.length > 0 && typeof password === "string" && await bcrypt.compare(password, String(rows[0].password_hash));
    if (!valid) return NextResponse.json({ error: "Username or password is incorrect." }, { status: 401 });
    const session = await getSession();
    session.userId = Number(rows[0].id);
    session.username = String(rows[0].username);
    await session.save();
    return NextResponse.json({ user: { id: session.userId, username: session.username } });
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Could not sign in. Try again." }, { status: 500 });
  }
}
