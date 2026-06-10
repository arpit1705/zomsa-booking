"use client";

import { useEffect, useMemo, useState } from "react";

// ---- date helpers (no timezone surprises; treat dates as plain YYYY-MM-DD) ----
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
// expand [start, end) into the list of nights (end is checkout = exclusive)
function nightsBetween(start, end) {
  const out = [];
  let cur = start;
  let guard = 0;
  while (cur < end && guard < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}
function monthMatrix(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const startDow = first.getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(ymd(new Date(Date.UTC(year, month, d))));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function Page() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth());
  const [editingDate, setEditingDate] = useState(null);

  async function load(refresh = false) {
    if (refresh) setSyncing(true);
    setLoading(true);
    try {
      const res = await fetch("/api/bookings" + (refresh ? "?refresh=1" : ""));
      const json = await res.json();
      setData(json);
      setErr(json.feedError || null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const totalRooms = data?.totalRooms || 2;

  // Build per-night occupancy map: date -> { used, items:[], blocked, note }
  const occupancy = useMemo(() => {
    const map = {};
    if (!data) return map;
    const notes = data.blockNotes || {};
    const all = [
      ...data.airbnb.map((b) => ({ ...b, kind: "airbnb" })),
      ...data.manual.map((b) => ({ ...b, kind: "manual" })),
    ];
    for (const b of all) {
      for (const night of nightsBetween(b.start, b.end)) {
        if (!map[night]) map[night] = { used: 0, items: [], blocked: false, note: "" };
        map[night].used += b.rooms || 0;
        map[night].items.push(b);
        if (b.kind === "airbnb" && b.type === "blocked") {
          map[night].blocked = true;
          map[night].note = notes[night] || "";
        }
      }
    }
    return map;
  }, [data]);

  // quick at-a-glance stats for the current month
  const stats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    let bookedNights = 0, fullDays = 0, totalDays = 0, conflicts = 0;
    for (const [date, o] of Object.entries(occupancy)) {
      if (!date.startsWith(prefix)) continue;
      totalDays++;
      if (o.used > 0) bookedNights++;
      if (o.used >= totalRooms) fullDays++;
      if (o.used > totalRooms) conflicts++;
    }
    return { bookedNights, fullDays, conflicts };
  }, [occupancy, year, month, totalRooms]);

  const weeks = monthMatrix(year, month);
  const todayStr = ymd(new Date());

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">🏡</div>
          <div>
            <h1>Homestay Calendar</h1>
            <p className="sub">{totalRooms} rooms · Airbnb sync + manual bookings</p>
          </div>
        </div>
        <button className="btn" onClick={() => load(true)} disabled={syncing}>
          {syncing ? "Syncing…" : "↻ Sync Airbnb"}
        </button>
      </header>

      {err && <div className="alert">⚠ Feed error: {err}</div>}

      {data?.fetchedAt && (
        <div className="synced">
          <span className="dot" />
          Airbnb synced {new Date(data.fetchedAt).toLocaleString()} {data.cached ? "· cached" : ""}
          <span style={{ marginLeft: 14, color: "var(--text-faint)" }}>
            · {stats.bookedNights} booked nights · {stats.fullDays} full this month
            {stats.conflicts > 0 && <span style={{ color: "#fca5a5" }}> · ⚠ {stats.conflicts} conflict{stats.conflicts > 1 ? "s" : ""}</span>}
          </span>
        </div>
      )}

      <div className="monthnav">
        <button className="btn btn-icon" onClick={prevMonth}>←</button>
        <h2>{MONTHS[month]} {year}</h2>
        <button className="btn btn-icon" onClick={nextMonth}>→</button>
      </div>

      <div className="cal-card">
        <div className="cal-grid">
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {weeks.flat().map((date, i) => (
            <DayCell
              key={i}
              date={date}
              occ={date ? occupancy[date] : null}
              totalRooms={totalRooms}
              isToday={date === todayStr}
              onBlockClick={setEditingDate}
            />
          ))}
        </div>
      </div>

      <Legend totalRooms={totalRooms} />

      <ManualForm onAdded={() => load()} totalRooms={totalRooms} />

      {data && <Assignments data={data} totalRooms={totalRooms} onChanged={() => load()} />}

      {data && <BlockedList airbnb={data.airbnb} blockNotes={data.blockNotes || {}} onEdit={setEditingDate} />}

      {data && <ManualList manual={data.manual} onDeleted={() => load()} />}

      {editingDate && (
        <BlockNoteEditor
          date={editingDate}
          note={(data?.blockNotes || {})[editingDate] || ""}
          onClose={() => setEditingDate(null)}
          onSaved={() => { setEditingDate(null); load(); }}
        />
      )}
    </div>
  );
}

function DayCell({ date, occ, totalRooms, isToday, onBlockClick }) {
  if (!date) return <div className="cell empty" />;
  const used = occ?.used || 0;
  const free = totalRooms - used;
  let cls = "cell";
  if (used === 0) cls += " is-free"; // hidden on mobile agenda
  if (used > 0 && free > 0) cls += " partial";
  if (free <= 0 && used > 0) cls += " full";
  if (used > totalRooms) cls = "cell over";
  if (isToday) cls += " today";
  const day = Number(date.slice(8, 10));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(date + "T00:00:00Z").getUTCDay()];
  const items = occ?.items || [];
  // Source markers for the compact (mobile) view. Distinguish three states:
  //   airbnb reservation (guest)  ·  airbnb block (no reservation)  ·  manual
  const markers = items.map((it) => {
    if (it.kind === "manual") return { cls: "manual", glyph: "✍" };
    if (it.type === "blocked") return { cls: "block", glyph: "🚫" };
    return { cls: "airbnb", glyph: "🅰" };
  });

  // On a blocked day, tapping the cell opens the reason editor (the text pill is
  // hidden on mobile, so the cell itself is the tap target there).
  const cellTap = occ?.blocked ? () => onBlockClick(date) : undefined;

  return (
    <div className={cls} onClick={cellTap} style={occ?.blocked ? { cursor: "pointer" } : undefined}>
      <div className="cell-head">
        <span className="cell-day">{day}</span>
        <span className="cell-dow-inline">{dow}</span>
        {used > 0 && <span className="cell-count">{used}/{totalRooms}</span>}
      </div>
      {used > totalRooms && <div className="over-tag">⚠ Overbooked</div>}

      {/* full pills (desktop) */}
      {items.map((it, idx) => {
        const isBlock = it.kind === "airbnb" && it.type === "blocked";
        if (isBlock) return null; // handled once per day below
        return (
          <span key={idx} className={`pill ${it.kind}`} title={it.reservationCode || it.label}>
            {it.kind === "airbnb" ? "🅰" : "✍"} {it.reservationCode || it.label}
          </span>
        );
      })}
      {occ?.blocked && (
        <span
          className={`pill block ${occ.note ? "" : "empty-note"}`}
          onClick={(e) => { e.stopPropagation(); onBlockClick(date); }}
          title="Click to add/edit the reason for this day"
        >
          🚫 {occ.note || "Add reason"}
        </span>
      )}

      {/* compact source markers (mobile): glyph identifies the source */}
      {markers.length > 0 && (
        <span className="dots">
          {markers.map((m, idx) => (
            <span key={idx} className={`mark ${m.cls}`}>{m.glyph}</span>
          ))}
        </span>
      )}
    </div>
  );
}

function BlockNoteEditor({ date, note: initialNote, onClose, onSaved }) {
  const [note, setNote] = useState(initialNote || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch("/api/blocknote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, note }),
    });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>🚫 Why is this day blocked?</h3>
        <p className="hint" style={{ marginBottom: 14 }}>
          <span className="code">{date}</span> · blocked on Airbnb (no reservation) · applies to this one day only.
        </p>
        <textarea
          className="textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
          placeholder="e.g. Maintenance · personal use · held for repeat guest"
          rows={3}
        />
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save reason"}</button>
        </div>
      </div>
    </div>
  );
}

function BlockedList({ airbnb, blockNotes, onEdit }) {
  const daySet = new Set();
  for (const b of airbnb) {
    if (b.type !== "blocked") continue;
    for (const night of nightsBetween(b.start, b.end)) daySet.add(night);
  }
  const days = Array.from(daySet).sort();
  if (!days.length) return null;
  return (
    <section className="card">
      <h3>🚫 Blocked dates</h3>
      <p className="hint">Airbnb doesn&apos;t say why these are blocked. Each day has its own reason.</p>
      <div className="table-wrap">
      <table className="table">
        <tbody>
          {days.map((date) => {
            const note = blockNotes[date] || "";
            return (
              <tr key={date}>
                <td className="code mono">{date}</td>
                <td className={note ? "" : "muted"}>{note || "No reason yet"}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-sm" onClick={() => onEdit(date)}>{note ? "Edit" : "Add reason"}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </section>
  );
}

function Legend({ totalRooms }) {
  const items = [
    { c: "var(--free)", t: "All free" },
    { c: "var(--partial-bg)", t: "Partially booked" },
    { c: "var(--full-bg)", t: `Full (${totalRooms}/${totalRooms})` },
    { c: "var(--danger-bg)", t: "Overbooked" },
  ];
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.t} className="legend-item">
          <span className="swatch" style={{ background: it.c }} /> {it.t}
        </span>
      ))}
      <span className="legend-item muted">🅰 Airbnb reservation</span>
      <span className="legend-item muted">🚫 Airbnb block</span>
      <span className="legend-item muted">✍ Manual booking</span>
    </div>
  );
}

function ManualForm({ onAdded, totalRooms }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rooms, setRooms] = useState(1);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!start || !end) return;
    setBusy(true);
    await fetch("/api/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end, rooms: Number(rooms), label }),
    });
    setStart(""); setEnd(""); setRooms(1); setLabel("");
    setBusy(false);
    onAdded();
  }

  return (
    <section className="card">
      <h3>➕ Add off-platform booking</h3>
      <p className="hint">For bookings that didn&apos;t come through Airbnb (direct, phone, walk-in).</p>
      <form onSubmit={submit} className="form-row">
        <label className="field"><span>Check-in</span><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
        <label className="field"><span>Check-out</span><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>
        <label className="field"><span>Rooms</span>
          <select className="select" value={rooms} onChange={(e) => setRooms(e.target.value)}>
            {Array.from({ length: totalRooms }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 180 }}><span>Guest / note</span><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Sharma family" /></label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add booking"}</button>
      </form>
      <p className="form-note">Check-out is the day they leave — that night isn&apos;t counted as booked.</p>
    </section>
  );
}

function Assignments({ data, totalRooms, onChanged }) {
  const seen = {};
  const reservations = [];
  for (const b of data.airbnb) {
    if (b.type !== "reserved" || !b.reservationCode) continue;
    if (seen[b.reservationCode]) continue;
    seen[b.reservationCode] = true;
    reservations.push(b);
  }
  if (!reservations.length) return null;

  async function setRooms(code, rooms) {
    await fetch("/api/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationCode: code, rooms: Number(rooms) }),
    });
    onChanged();
  }

  return (
    <section className="card">
      <h3>🅰 Airbnb reservations</h3>
      <p className="hint">Airbnb doesn&apos;t tell us the room count. Default is all {totalRooms} — set the real number per booking.</p>
      <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Reservation</th><th>Dates</th><th>Phone</th><th>Rooms blocked</th></tr>
        </thead>
        <tbody>
          {reservations.map((r) => (
            <tr key={r.reservationCode}>
              <td>
                <span className="code">{r.reservationCode}</span>{" "}
                {!r.assigned && <span className="badge warn">default</span>}
              </td>
              <td className="mono muted">{r.start} → {r.end}</td>
              <td className="muted">{r.phoneLast4 ? "••" + r.phoneLast4 : "—"}</td>
              <td>
                <select className="select" value={r.rooms} onChange={(e) => setRooms(r.reservationCode, e.target.value)}>
                  {Array.from({ length: totalRooms }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}

function ManualList({ manual, onDeleted }) {
  if (!manual.length) return null;
  async function del(id) {
    await fetch("/api/manual?id=" + encodeURIComponent(id), { method: "DELETE" });
    onDeleted();
  }
  return (
    <section className="card">
      <h3>✍ Off-platform bookings</h3>
      <div className="table-wrap">
      <table className="table">
        <tbody>
          {manual.map((m) => (
            <tr key={m.id}>
              <td style={{ fontWeight: 550 }}>{m.label}</td>
              <td className="mono muted">{m.start} → {m.end}</td>
              <td className="muted">{m.rooms} room{m.rooms > 1 ? "s" : ""}</td>
              <td style={{ textAlign: "right" }}><button className="btn btn-danger" onClick={() => del(m.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}
