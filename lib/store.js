import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

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

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2));
  }
}

export async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  return { ...DEFAULT_STORE, ...JSON.parse(raw) };
}

export async function writeStore(store) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
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
