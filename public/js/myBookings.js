const msg = document.getElementById("msg");
const bookingsList = document.getElementById("bookingsList");
const statusFilter = document.getElementById("statusFilter");
 
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", loadBookings);
if (statusFilter) statusFilter.addEventListener("change", loadBookings);
 
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
 
function statusColour(status) {
  if (status === "accepted") return "var(--ok)";
  if (status === "rejected") return "var(--danger)";
  if (status === "cancelled") return "var(--muted)";
  return "var(--accent)";
}
 
function card(b) {
  const status = normStatus(b.booking_status);
  const canCancel = status === "requested";
  const urgentBadge = b.is_urgent
    ? `<span style="background:var(--danger);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:6px;">URGENT</span>`
    : "";
 
  return `
    <div class="item" style="flex-direction:column;align-items:flex-start;gap:10px;">
 
      <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:6px;align-items:flex-start;">
        <div>
          <div class="item-title" style="font-size:1rem;">${esc(b.title)}${urgentBadge}</div>
          ${b.session_type ? `<div class="muted" style="font-size:13px;margin-top:2px;">${esc(b.session_type)}</div>` : ""}
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="pill ${status}" style="color:${statusColour(status)};">${status}</span>
          ${canCancel ? `<button class="btn danger" style="font-size:12px;padding:6px 10px;" data-cancel="${b.booking_id}">Cancel</button>` : ""}
        </div>
      </div>
 
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;width:100%;font-size:13px;">
        <div class="muted">📅 ${fmtDate(b.shift_date)}</div>
        <div class="muted">🕐 ${fmtTime(b.start_time)} – ${fmtTime(b.end_time)}</div>
        <div class="muted">🎓 ${esc(b.level_required)}</div>
        <div class="muted">💷 £${b.pay_rate}/hr${b.expenses_included ? " + expenses" : ""}</div>
        ${b.shift_postcode ? `<div class="muted">📍 ${esc(b.shift_postcode)}</div>` : ""}
        ${b.min_dbs_type ? `<div class="muted">🔒 Min DBS: ${esc(b.min_dbs_type)}</div>` : ""}
      </div>
 
      <div style="font-size:13px;color:var(--muted);padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;width:100%;box-sizing:border-box;">
        <strong>${esc(b.organisation_name)}</strong> • ${esc(b.organisation_postcode)} • ${esc(b.contact_phone)}
      </div>
 
      ${b.description ? `<div style="font-size:13px;color:var(--muted);font-style:italic;border-left:3px solid var(--border);padding-left:10px;">${esc(b.description)}</div>` : ""}
 
      ${b.shift_postcode ? `
        <details style="width:100%;">
          <summary style="cursor:pointer;font-size:13px;color:var(--accent);">View map</summary>
          <div style="margin-top:8px;border-radius:10px;overflow:hidden;">
            <iframe
              src="https://maps.google.com/maps?q=${encodeURIComponent((b.shift_postcode || "") + ', UK')}&output=embed&z=14"
              width="100%" height="180" frameborder="0" style="border:0;border-radius:10px;" allowfullscreen>
            </iframe>
          </div>
        </details>
      ` : ""}
    </div>
  `;
}
 
async function loadBookings() {
  msg.style.display = "none";
  bookingsList.innerHTML = `<div class="muted">Loading…</div>`;
 
  try {
    const data = await api("/api/instructor/bookings", { method: "GET" });
    let bookings = data.bookings || [];
 
    const st = normStatus(statusFilter?.value);
    if (st) bookings = bookings.filter(b => normStatus(b.booking_status) === st);
 
    bookings.sort((a, b) => Number(b.booking_id) - Number(a.booking_id));
 
    if (!bookings.length) {
      bookingsList.innerHTML = `<div class="muted">No applications found.</div>`;
      return;
    }
 
    bookingsList.innerHTML = bookings.map(card).join("");
 
    bookingsList.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-cancel");
        if (!confirm("Cancel this application?")) return;
        try {
          await api(`/api/bookings/${id}/cancel`, { method: "POST", body: "{}" });
          show("ok", "Application cancelled.");
          await loadBookings();
        } catch (err) {
          show("error", err.message);
        }
      });
    });
  } catch (err) {
    bookingsList.innerHTML = "";
    show("error", err.message);
  }
}
 
(async () => {
  await guard(["instructor", "admin"]);
  await loadBookings();
})();