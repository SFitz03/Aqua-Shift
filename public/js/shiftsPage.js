const msg = document.getElementById("msg");
const openShiftsList = document.getElementById("openShiftsList");
const myBookingsList = document.getElementById("myBookingsList");
 
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshShiftsBtn").addEventListener("click", load);
document.getElementById("refreshBookingsBtn").addEventListener("click", load);
 
function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}
 
function esc(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
 
function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
}
 
function fmtTime(t) { return String(t || "").slice(0, 5); }
function normStatus(v) { return String(v || "").toLowerCase(); }
 
function shiftCard(s, booking) {
  const status = booking ? normStatus(booking.booking_status) : null;
 
  const urgentBadge = s.is_urgent
    ? `<span style="background:var(--danger);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:6px;">URGENT</span>`
    : "";
 
  let actionHtml = `<button class="btn primary" data-apply="${s.id}">Apply</button>`;
  if (status === "requested") actionHtml = `<span class="pill requested">Applied</span>`;
  if (status === "accepted") actionHtml = `<span class="pill accepted">Accepted</span>`;
  if (status === "rejected") actionHtml = `<span class="pill rejected">Rejected</span>`;
  if (status === "cancelled") actionHtml = `<button class="btn primary" data-apply="${s.id}">Apply again</button>`;
 
  return `
    <div class="item" style="flex-direction:column;align-items:flex-start;gap:10px;">
      <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:6px;align-items:flex-start;">
        <div>
          <div class="item-title" style="font-size:1rem;">${esc(s.title)}${urgentBadge}</div>
          ${s.session_type ? `<div class="muted" style="font-size:13px;margin-top:2px;">${esc(s.session_type)}</div>` : ""}
        </div>
        <div>${actionHtml}</div>
      </div>
 
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;width:100%;font-size:13px;">
        <div class="muted">📅 ${fmtDate(s.shift_date)}</div>
        <div class="muted">🕐 ${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}</div>
        <div class="muted">🎓 ${esc(s.level_required)}</div>
        <div class="muted">💷 £${esc(String(s.pay_rate))}/hr${s.expenses_included ? " + expenses" : ""}</div>
        ${s.postcode ? `<div class="muted">📍 ${esc(s.postcode)}</div>` : ""}
        ${s.min_dbs_type ? `<div class="muted">🔒 Min DBS: ${esc(s.min_dbs_type)}</div>` : ""}
        ${s.instructors_needed > 1 ? `<div class="muted">👥 ${s.instructors_needed} instructors needed</div>` : ""}
      </div>
 
      ${s.description ? `<div style="font-size:13px;color:var(--muted);font-style:italic;border-left:3px solid var(--border);padding-left:10px;">${esc(s.description)}</div>` : ""}
 
      ${s.directions ? `<div style="font-size:13px;color:var(--text);background:rgba(0,201,200,0.07);border:1px solid rgba(0,201,200,0.2);border-radius:8px;padding:10px 12px;"><strong style="color:var(--accent);">🗺️ Directions</strong><br>${esc(s.directions)}</div>` : ""}
 
      ${s.postcode ? `
        <div style="margin-top:8px;border-radius:10px;overflow:hidden;">
          <iframe
            src="https://maps.google.com/maps?q=${encodeURIComponent(s.postcode + ', UK')}&output=embed&z=14"
            width="100%" height="180" frameborder="0" style="border:0;border-radius:10px;" allowfullscreen>
          </iframe>
        </div>
      ` : ""}
 
 
    </div>
  `;
}
 
function bookingCard(b) {
  const status = normStatus(b.booking_status);
  const canCancel = status === "requested";
  return `
    <div class="item" style="flex-direction:column;align-items:flex-start;">
      <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:6px;">
        <div>
          <div class="item-title" style="font-size:.95rem;">${esc(b.title)}</div>
          <div class="muted" style="font-size:13px;margin-top:3px;">
            ${fmtDate(b.shift_date)} • ${fmtTime(b.start_time)}–${fmtTime(b.end_time)}
          </div>
          <div class="muted" style="font-size:13px;">${esc(b.organisation_name)} • £${b.pay_rate}/hr</div>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <span class="pill ${status}">${status}</span>
          ${canCancel ? `<button class="btn danger" style="font-size:12px;padding:6px 10px;" data-cancel-booking="${b.booking_id}">Cancel</button>` : ""}
        </div>
      </div>
    </div>
  `;
}
 
async function load() {
  msg.style.display = "none";
  openShiftsList.innerHTML = `<div class="muted">Loading…</div>`;
  myBookingsList.innerHTML = `<div class="muted">Loading…</div>`;
 
  try {
    const [shiftsData, bookingsData] = await Promise.all([
      api("/api/shifts?status=open", { method: "GET" }),
      api("/api/instructor/bookings", { method: "GET" }).catch(() => ({ bookings: [] }))
    ]);
 
    const shifts = shiftsData?.shifts || [];
    const bookings = bookingsData?.bookings || [];
 
    // Map bookings by shift_id
    const bookingByShiftId = new Map();
    for (const b of bookings) {
      if (!b.shift_id) continue;
      const existing = bookingByShiftId.get(b.shift_id);
      const rank = { accepted: 4, requested: 3, rejected: 2, cancelled: 1 };
      const cur = rank[normStatus(b.booking_status)] || 0;
      const ex = existing ? (rank[normStatus(existing.booking_status)] || 0) : 0;
      if (!existing || cur > ex) bookingByShiftId.set(b.shift_id, b);
    }
 
    // Open shifts — urgent first
    const sorted = [...shifts].sort((a, b) => (b.is_urgent || 0) - (a.is_urgent || 0));
    if (sorted.length === 0) {
      openShiftsList.innerHTML = `<div class="muted">No open shifts right now.</div>`;
    } else {
      openShiftsList.innerHTML = sorted.map(s => shiftCard(s, bookingByShiftId.get(s.id))).join("");
      openShiftsList.querySelectorAll("[data-apply]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const shiftId = btn.getAttribute("data-apply");
          btn.disabled = true;
          try {
            await api(`/api/shifts/${shiftId}/apply`, { method: "POST", body: "{}" });
            show("ok", "Applied successfully!");
            await load();
          } catch (err) {
            show("error", err.message);
            btn.disabled = false;
          }
        });
      });
    }
 
    // My bookings — newest first
    if (bookings.length === 0) {
      myBookingsList.innerHTML = `<div class="muted">No applications yet.</div>`;
    } else {
      const sorted = [...bookings].sort((a, b) => b.booking_id - a.booking_id);
      myBookingsList.innerHTML = sorted.map(bookingCard).join("");
      myBookingsList.querySelectorAll("[data-cancel-booking]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-cancel-booking");
          if (!confirm(`Cancel this application?`)) return;
          try {
            await api(`/api/bookings/${id}/cancel`, { method: "POST", body: "{}" });
            show("ok", "Application cancelled.");
            await load();
          } catch (err) {
            show("error", err.message);
          }
        });
      });
    }
 
  } catch (err) {
    show("error", err.message);
    openShiftsList.innerHTML = `<div class="muted">Failed to load.</div>`;
  }
}
 
(async () => {
  await guard(["instructor", "admin"]);
  await load();
})();