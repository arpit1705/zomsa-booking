import { NextResponse } from "next/server";
import { setBlockNote } from "../../../lib/store";

// Add/update/clear a note explaining why a specific blocked DATE is blocked.
// Keyed by individual date (YYYY-MM-DD) so each day in a blocked range is
// independent. Send empty note to clear.
export async function POST(request) {
  const { date, note } = await request.json();
  if (!date) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }
  await setBlockNote(date, note || "");
  return NextResponse.json({ ok: true });
}
