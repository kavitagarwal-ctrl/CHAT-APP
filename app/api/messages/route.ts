import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const rows = await sql`
    SELECT m.id, m.body, m.created_at, m.sender_id, u.username
    FROM (SELECT * FROM messages ORDER BY id DESC LIMIT 100) m
    JOIN users u ON u.id = m.sender_id
    ORDER BY m.id ASC
  `;
  return NextResponse.json({ messages: rows.map((m) => ({
    id: String(m.id), body: String(m.body), senderId: Number(m.sender_id), username: String(m.username), createdAt: m.created_at
  })) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const { body: rawBody } = await request.json();
    const body = typeof rawBody === "string" ? rawBody.trim() : "";
    if (!body || body.length > 1000) return NextResponse.json({ error: "Message must be 1–1000 characters." }, { status: 400 });
    const rows = await sql`INSERT INTO messages (sender_id, body) VALUES (${session.userId}, ${body}) RETURNING id`;
    return NextResponse.json({ id: String(rows[0].id) }, { status: 201 });
  } catch (error) {
    console.error("Message send failed", error);
    return NextResponse.json({ error: "Could not send message." }, { status: 500 });
  }
}
