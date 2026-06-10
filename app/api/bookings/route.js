import { NextResponse } from "next/server";
import { fetchAirbnbEvents } from "../../../lib/airbnb";
import { readStore } from "../../../lib/store";

export const dynamic = "force-dynamic";

// Returns the combined view: Airbnb reservations (with their room assignment)
// + manual off-platform bookings. The UI renders both on one calendar.
export async function GET(request) {
  const force = new URL(request.url).searchParams.get("refresh") === "1";

  let airbnb = [];
  let feedError = null;
  let fetchedAt = null;
  let cached = false;
  try {
    const result = await fetchAirbnbEvents({ force });
    airbnb = result.events;
    fetchedAt = result.fetchedAt;
    cached = result.cached;
  } catch (e) {
    feedError = e.message;
  }

  const store = await readStore();
  const totalRooms = Number(process.env.TOTAL_ROOMS || 2);

  const airbnbBookings = airbnb.map((ev) => {
    // Default: an Airbnb booking blocks ALL rooms (the whole-listing behavior),
    // unless you've told us otherwise for this reservation code.
    const assigned =
      ev.reservationCode && ev.reservationCode in store.roomAssignments
        ? store.roomAssignments[ev.reservationCode]
        : totalRooms;
    return {
      ...ev,
      rooms: assigned,
      assigned: ev.reservationCode ? ev.reservationCode in store.roomAssignments : true,
    };
  });

  return NextResponse.json({
    totalRooms,
    fetchedAt,
    cached,
    feedError,
    airbnb: airbnbBookings,
    manual: store.manualBookings,
    // Per-date block notes (YYYY-MM-DD -> reason). Frontend looks these up per day.
    blockNotes: store.blockNotes || {},
  });
}
