import { Redis } from "@upstash/redis";

// Single JSON blob holding the whole store, kept in Upstash Redis (added via the
// Vercel Marketplace integration) so it's shared across devices and survives
// Vercel's ephemeral filesystem. fromEnv() reads KV_REST_API_URL / _TOKEN, which
// the integration injects automatically.
const redis = Redis.fromEnv();
const STORE_KEY = "zomsa:store";

const DEFAULT_STORE = {
  // Airbnb reservation code -> number of rooms that booking occupies.
  // The iCal feed can't tell us this, so you set it manually.
  roomAssignments: {},
  // Off-platform bookings you add yourself.
  manualBookings: [],
  // Blocked-date note, keyed by individual date (YYYY-MM-DD) so each day in a
  // blocked range can have its own reason.
  blockNotes: {},
};

export async function readStore() {
  const stored = await redis.get(STORE_KEY);
  return { ...DEFAULT_STORE, ...(stored || {}) };
}

export async function writeStore(store) {
  await redis.set(STORE_KEY, store);
  return store;
}

export async function setRoomAssignment(reservationCode, rooms) {
  const store = await readStore();
  store.roomAssignments[reservationCode] = rooms;
  return writeStore(store);
}

export async function setBlockNote(date, note) {
  const store = await readStore();
  if (note && note.trim()) {
    store.blockNotes[date] = note.trim();
  } else {
    delete store.blockNotes[date];
  }
  return writeStore(store);
}

export async function addManualBooking(booking) {
  const store = await readStore();
  // id without Date.now/Math.random (unavailable in some contexts) — derive from content
  const id =
    "m-" +
    Buffer.from(
      `${booking.start}|${booking.end}|${booking.label || ""}|${store.manualBookings.length}`
    )
      .toString("base64url")
      .slice(0, 12);
  const entry = { id, rooms: 1, ...booking };
  store.manualBookings.push(entry);
  await writeStore(store);
  return entry;
}

export async function deleteManualBooking(id) {
  const store = await readStore();
  store.manualBookings = store.manualBookings.filter((b) => b.id !== id);
  return writeStore(store);
}
