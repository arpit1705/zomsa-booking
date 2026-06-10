import { NextResponse } from "next/server";
import { setRoomAssignment } from "../../../lib/store";

// Set how many rooms a given Airbnb reservation actually occupies.
export async function POST(request) {
  const { reservationCode, rooms } = await request.json();
  if (!reservationCode || typeof rooms !== "number") {
    return NextResponse.json({ error: "reservationCode and numeric rooms required" }, { status: 400 });
  }
  await setRoomAssignment(reservationCode, rooms);
  return NextResponse.json({ ok: true });
}
