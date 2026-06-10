# 🏡 Homestay Calendar

A unified occupancy calendar for a multi-room homestay. It syncs your Airbnb
reservations (read-only, via the iCal export) and lets you add off-platform
bookings, so you have **one place to check before accepting any booking**.

## Why this exists

Airbnb treats your homestay as a single unit: one Airbnb booking blocks *all*
rooms, even for one guest. And the iCal feed can't tell you how many rooms a
booking really needs. This app fixes the visibility problem:

- **Airbnb reservations sync in automatically** (every 15 min).
- For each Airbnb reservation, **you set how many rooms it actually blocks**
  (defaults to all rooms).
- **You add off-platform bookings manually.**
- Each day shows **X / N rooms booked**, with an **OVERBOOKED** warning if you
  ever exceed capacity.

> Note: this app only *reads* Airbnb. It does not (and can't) write back — see
> "Limitations".

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create your env file:
   ```
   copy .env.local.example .env.local   (Windows)
   ```
   Then edit `.env.local`:
   - `AIRBNB_ICAL_URL` — your Airbnb iCal export link
     (Airbnb → Listings → Availability → *Connect to another website* → copy link)
   - `TOTAL_ROOMS` — number of rooms (e.g. `2`)
3. Run:
   ```
   npm run dev
   ```
   Open http://localhost:3000

## Using it

- **Sync Airbnb** button refreshes the feed (it's cached 15 min; the feed isn't
  real-time on Airbnb's side anyway).
- **Airbnb reservations** table: set rooms blocked per reservation.
- **Add off-platform booking** form: dates + rooms + a note.
- **Blocked dates**: Airbnb blocks with no reservation show as `🚫 Blocked`.
  Click one in the calendar (or use the *Airbnb blocked dates* table) to record
  *why* it's blocked — maintenance, personal use, held for a guest, etc.
- Calendar colors: free / partial / full / **overbooked**.

## Data

Everything is stored in `data/store.json` (gitignored). Back that file up to
keep your room assignments and manual bookings.

## Security

- Your iCal URL is a **secret** — anyone with it can read your availability.
  It lives only in `.env.local` (gitignored), never in code.
- If the link leaks, reset it in Airbnb (re-export the calendar).

## Limitations (by design / by Airbnb)

- **Read-only sync.** Can't push blocks back to Airbnb via iCal per-room.
- **No guest count / names / price** — not in the Airbnb iCal feed.
- **Room assignment for Airbnb bookings is manual** — the feed has no room info.

## Deploying later

It's structured to deploy (e.g. Vercel). For a hosted version you'd swap
`data/store.json` for a real database (the storage layer is isolated in
`lib/store.js`), and set the env vars in the host's dashboard.
