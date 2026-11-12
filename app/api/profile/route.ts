import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const { username: rawUsername } = await request.json();
    const username = typeof rawUsername === "string" ? rawUsername.trim().toLowerCase() : "";
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: "Username must be 3–20 characters: letters, numbers, or underscores." }, { status: 400 });
    }
    const rows = await sql`UPDATE users SET username = ${username} WHERE id = ${session.userId} RETURNING id, username`;
    if (!rows.length) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    session.username = String(rows[0].username);
    await session.save();
    return NextResponse.json({ user: { id: Number(rows[0].id), username: String(rows[0].username) } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    console.error("Profile update failed", error);
    return NextResponse.json({ error: "Could not update your profile." }, { status: 500 });
  }
}
