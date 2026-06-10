import { NextResponse } from "next/server";
import { addManualBooking, deleteManualBooking } from "../../../lib/store";

// Add an off-platform booking.
export async function POST(request) {
  const body = await request.json();
  const { start, end, rooms, label } = body;
  if (!start || !end) {
    return NextResponse.json({ error: "start and end (YYYY-MM-DD) required" }, { status: 400 });
  }
  const entry = await addManualBooking({
    start,
    end,
    rooms: Number(rooms) || 1,
    label: label || "Off-platform booking",
    source: "manual",
  });
  return NextResponse.json({ ok: true, booking: entry });
}

export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteManualBooking(id);
  return NextResponse.json({ ok: true });
}
