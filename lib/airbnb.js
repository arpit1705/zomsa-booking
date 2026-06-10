// Fetch + parse the Airbnb iCal feed into clean reservation objects.
// The feed gives us: date range, Reserved vs blocked, reservation code, phone last-4.
// It does NOT tell us how many rooms a booking uses — that's set manually in the store.

let cache = { at: 0, data: null };
const CACHE_MS = 15 * 60 * 1000; // 15 min — feed isn't real-time anyway

function unfold(text) {
  // iCal folds long lines with CRLF + space/tab. Join them back.
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

// "20260609" -> "2026-06-09"
function parseIcalDate(value) {
  const m = value.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseEvents(ics) {
  const text = unfold(ics);
  const blocks = text.split("BEGIN:VEVENT").slice(1);
  const events = [];

  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0];
    const get = (key) => {
      const re = new RegExp(`${key}[^:\\r\\n]*:([^\\r\\n]*)`);
      const match = body.match(re);
      return match ? match[1].trim() : null;
    };

    const start = parseIcalDate(get("DTSTART") || "");
    const end = parseIcalDate(get("DTEND") || ""); // exclusive (checkout day)
    const summary = get("SUMMARY") || "";
    const uid = get("UID") || "";
    const description = get("DESCRIPTION") || "";

    if (!start || !end) continue;

    const isReserved = /reserved/i.test(summary);

    let reservationCode = null;
    const codeMatch = description.match(/details\/([A-Z0-9]+)/);
    if (codeMatch) reservationCode = codeMatch[1];

    let phoneLast4 = null;
    const phoneMatch = description.match(/Last 4 Digits\)?:\s*(\d{4})/i);
    if (phoneMatch) phoneLast4 = phoneMatch[1];

    events.push({
      uid,
      start,
      end,
      summary,
      type: isReserved ? "reserved" : "blocked",
      reservationCode,
      phoneLast4,
      source: "airbnb",
    });
  }
  return events;
}

export async function fetchAirbnbEvents({ force = false } = {}) {
  const now = force ? Infinity : Date.now ? Date.now() : 0;
  if (!force && cache.data && now - cache.at < CACHE_MS) {
    return { events: cache.data, cached: true, fetchedAt: cache.at };
  }

  const url = process.env.AIRBNB_ICAL_URL;
  if (!url) {
    throw new Error("AIRBNB_ICAL_URL is not set. Copy .env.local.example to .env.local.");
  }

  const res = await fetch(url, { headers: { "User-Agent": "homestay-calendar" } });
  if (!res.ok) {
    throw new Error(`Failed to fetch Airbnb feed: ${res.status} ${res.statusText}`);
  }
  const ics = await res.text();
  const events = parseEvents(ics);

  const at = Date.now ? Date.now() : 0;
  cache = { at, data: events };
  return { events, cached: false, fetchedAt: at };
}
