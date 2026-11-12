import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const rows = await sql`SELECT notifications_enabled, browser_notifications_enabled FROM users WHERE id = ${session.userId} LIMIT 1`;
  if (!rows.length) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({
    settings: {
      notificationsEnabled: Boolean(rows[0].notifications_enabled),
      browserNotificationsEnabled: Boolean(rows[0].browser_notifications_enabled)
    }
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const { notificationsEnabled, browserNotificationsEnabled } = await request.json();
    if (typeof notificationsEnabled !== "boolean" || typeof browserNotificationsEnabled !== "boolean") {
      return NextResponse.json({ error: "Notification settings must be true or false." }, { status: 400 });
    }
    await sql`UPDATE users SET notifications_enabled = ${notificationsEnabled}, browser_notifications_enabled = ${browserNotificationsEnabled} WHERE id = ${session.userId}`;
    return NextResponse.json({ settings: { notificationsEnabled, browserNotificationsEnabled } });
  } catch (error) {
    console.error("Saving settings failed", error);
    return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
}
