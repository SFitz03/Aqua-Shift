const msg = document.getElementById("msg");
const bookingsList = document.getElementById("bookingsList");
const statusFilter = document.getElementById("statusFilter");
 
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
 
if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (refreshBtn) refreshBtn.addEventListener("click", loadBookings);
if (statusFilter) statusFilter.addEventListener("change", loadBookings);
 
// ── Rating modal ──────────────────────────────────────────────────────────────
let activeBookingId = null;
let selectedRating = 0;
 
(function ensureRatingModal() {
  if (document.getElementById("ratingModal")) return;
  const modal = document.createElement("div");
  modal.id = "ratingModal";
  modal.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;";
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px 32px;min-width:320px;max-width:460px;width:90%;">
      <h3 style="margin:0 0 14px;color:var(--text);">Rate Instructor</h3>
      <div id="ratingStarPicker" style="font-size:2.2rem;cursor:pointer;user-select:none;letter-spacing:6px;margin-bottom:8px;">
        <span>☆</span><span>☆</span><span>☆</span><span>☆</span><span>☆</span>
      </div>
      <div id="ratingSelectedText" style="color:var(--muted);font-size:.88rem;margin-bottom:16px;">Selected: —</div>
      <textarea id="ratingCommentInput" placeholder="Feedback for the instructor…"
        style="width:100%;min-height:70px;padding:8px;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,0.04);color:var(--text);font-size:.92rem;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;">
        <button class="btn" id="cancelRatingModalBtn">Cancel</button>
        <button class="btn primary" id="submitRatingModalBtn">Submit</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
 
  const starPicker = document.getElementById("ratingStarPicker");
  const stars = starPicker.querySelectorAll("span");
  const selectedText = document.getElementById("ratingSelectedText");
 
  function renderStars(value) {
    stars.forEach((star, i) => {
      const n = i + 1;
      star.textContent = value >= n ? "★" : value >= n - 0.5 ? "⯨" : "☆";
      star.style.color = value >= n - 0.5 ? "var(--accent)" : "var(--muted)";
    });
    selectedText.textContent = value ? `Selected: ${value} / 5` : "Selected: —";
  }
 
  stars.forEach((star, index) => {
    star.addEventListener("mousemove", (e) => {
      const rect = star.getBoundingClientRect();
      renderStars(index + (e.clientX - rect.left < rect.width / 2 ? 0.5 : 1));
    });
    star.addEventListener("click", (e) => {
      const rect = star.getBoundingClientRect();
      selectedRating = index + (e.clientX - rect.left < rect.width / 2 ? 0.5 : 1);
      renderStars(selectedRating);
    });
  });
  starPicker.addEventListener("mouseleave", () => renderStars(selectedRating));
 
  document.getElementById("cancelRatingModalBtn").addEventListener("click", closeRatingModal);
  document.getElementById("submitRatingModalBtn").addEventListener("click", submitRating);
})();
 
function openRatingModal(bookingId) {
  activeBookingId = bookingId;
  selectedRating = 0;
  document.getElementById("ratingCommentInput").value = "";
  document.querySelectorAll("#ratingStarPicker span").forEach(s => { s.textContent = "☆"; s.style.color = "var(--muted)"; });
  document.getElementById("ratingSelectedText").textContent = "Selected: —";
  document.getElementById("ratingModal").style.display = "flex";
}
 
function closeRatingModal() {
  activeBookingId = null;
  selectedRating = 0;
  document.getElementById("ratingModal").style.display = "none";
}
 
async function submitRating() {
  if (!activeBookingId || !selectedRating) { alert("Please select a rating."); return; }
  const comment = document.getElementById("ratingCommentInput").value.trim();
  try {
    await api(`/api/org/bookings/${activeBookingId}/rate`, {
      method: "POST",
      body: JSON.stringify({ rating: selectedRating, comment })
    });
    show("ok", "Rating submitted.");
    closeRatingModal();
    await loadBookings();
  } catch (err) { show("error", err.message); }
}
 
// ── Helpers ───────────────────────────────────────────────────────────────────
function show(type, text) {
  if (!msg) return;
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
function normStatus(v) { return String(v || "unknown").toLowerCase(); }
 
function starDisplay(value) {
  if (!value) return "No ratings yet";
  const full = Math.floor(value);
  const half = value % 1 >= 0.5 ? 1 : 0;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - half) + ` (${value})`;
}
 
// ── Instructor card ───────────────────────────────────────────────────────────
function instructorCard(b) {
  const bookingStatus = normStatus(b.booking_status);
  const shiftStatus = normStatus(b.shift_status);
  const dbsStatus = normStatus(b.dbs_status || (b.dbs_checked ? "verified" : "not_submitted"));
 
  const canAccept = bookingStatus === "requested" && shiftStatus === "open" && dbsStatus === "verified";
  const canReject = bookingStatus === "requested";
  const canRate = bookingStatus === "accepted" && !b.rating_id;
  const alreadyRated = !!b.rating_id;
 
  const dbsColour = dbsStatus === "verified" ? "var(--ok)" : dbsStatus === "pending" ? "var(--accent)" : "var(--danger)";
 
  const availText = [
    b.availability_days,
    b.availability_start && b.availability_end ? `${fmtTime(b.availability_start)}–${fmtTime(b.availability_end)}` : null
  ].filter(Boolean).join(" • ") || "Not set";
 
  return `
    <div style="
      background:rgba(255,255,255,0.03);border:1px solid var(--border);
      border-radius:12px;padding:14px 16px;margin-bottom:10px;
    ">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:flex-start;">
        <div style="flex:1;min-width:200px;">
 
          <div style="font-weight:700;font-size:1rem;color:var(--text);margin-bottom:6px;">
            ${esc(b.instructor_name)}
            <span style="font-size:12px;font-weight:400;color:var(--muted);margin-left:6px;">${esc(b.instructor_email)}</span>
          </div>
 
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px;margin-bottom:8px;">
            <div class="muted">🎓 ${esc(b.qualification_level || "—")}</div>
            <div style="color:${dbsColour};">🔒 DBS: ${dbsStatus}</div>
            <div class="muted">📍 ${esc(b.instructor_postcode || "—")}</div>
            <div class="muted">⭐ ${starDisplay(b.avg_rating)} <span style="font-size:11px;">(${b.total_ratings || 0} ratings)</span></div>
            <div class="muted" style="grid-column:span 2;">🗓️ Availability: ${esc(availText)}</div>
          </div>
 
          ${b.bio ? `<div style="font-size:13px;color:var(--muted);font-style:italic;border-left:3px solid var(--border);padding-left:10px;margin-bottom:8px;">${esc(b.bio)}</div>` : ""}
 
          ${bookingStatus !== "requested" ? `<span class="pill ${bookingStatus}" style="font-size:12px;">${bookingStatus}</span>` : ""}
          ${dbsStatus !== "verified" && bookingStatus === "requested" ? `<div style="font-size:12px;color:var(--danger);margin-top:4px;">⚠️ Cannot accept — DBS not verified</div>` : ""}
          ${alreadyRated ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">Rated: ${b.rating}/5 • ${b.comment || "No comment"}</div>` : ""}
        </div>
 
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
          ${canAccept ? `<button class="btn primary" data-accept="${b.booking_id}">Accept</button>` : ""}
          ${canReject ? `<button class="btn danger" data-reject="${b.booking_id}">Reject</button>` : ""}
          ${canRate ? `<button class="btn primary" data-rate="${b.booking_id}">Rate</button>` : ""}
        </div>
      </div>
    </div>
  `;
}
 
// ── Shift group ───────────────────────────────────────────────────────────────
function shiftGroup(shiftId, bookings) {
  const s = bookings[0];
  const when = `${fmtDate(s.shift_date)} • ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`;
  const shiftStatus = normStatus(s.shift_status);
  const applicantCount = bookings.filter(b => normStatus(b.booking_status) === "requested").length;
 
  return `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-bottom:14px;">
        <div>
          <div style="font-weight:700;font-size:1.05rem;color:var(--text);">
            ${esc(s.title)}
            <span class="pill ${shiftStatus}" style="font-size:12px;margin-left:6px;">${shiftStatus}</span>
          </div>
          <div class="muted" style="font-size:13px;margin-top:4px;">
            ${when} • £${s.pay_rate}/hr
            ${applicantCount > 0 ? `<span style="color:var(--danger);font-weight:700;margin-left:8px;">${applicantCount} pending</span>` : ""}
          </div>
        </div>
        <div class="muted" style="font-size:13px;">${bookings.length} application${bookings.length !== 1 ? "s" : ""}</div>
      </div>
 
      ${bookings.map(instructorCard).join("")}
    </div>
  `;
}
 
// ── Load ──────────────────────────────────────────────────────────────────────
async function loadBookings() {
  if (!bookingsList) return;
  if (msg) msg.style.display = "none";
  bookingsList.innerHTML = `<div class="muted">Loading…</div>`;
 
  try {
    const data = await api("/api/org/bookings", { method: "GET" });
    let bookings = data.bookings || [];
 
    const st = statusFilter?.value || "";
    if (st) bookings = bookings.filter(b => normStatus(b.booking_status) === st);
 
    if (!bookings.length) {
      bookingsList.innerHTML = `<div class="muted">No bookings found.</div>`;
      return;
    }
 
    // Group by shift_id, pending shifts first
    const groups = new Map();
    for (const b of bookings) {
      if (!groups.has(b.shift_id)) groups.set(b.shift_id, []);
      groups.get(b.shift_id).push(b);
    }
 
    // Sort groups — shifts with pending bookings first
    const sorted = [...groups.entries()].sort(([, a], [, b]) => {
      const aPending = a.some(x => normStatus(x.booking_status) === "requested") ? 0 : 1;
      const bPending = b.some(x => normStatus(x.booking_status) === "requested") ? 0 : 1;
      return aPending - bPending;
    });
 
    bookingsList.innerHTML = sorted.map(([shiftId, bks]) => shiftGroup(shiftId, bks)).join("");
 
    // Wire buttons
    bookingsList.querySelectorAll("[data-accept]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-accept");
        if (!confirm(`Accept this instructor? This will fill the shift and reject other applicants.`)) return;
        try {
          await api(`/api/org/bookings/${id}/accept`, { method: "POST", body: "{}" });
          show("ok", "Booking accepted.");
          await loadBookings();
        } catch (err) { show("error", err.message); }
      });
    });
 
    bookingsList.querySelectorAll("[data-reject]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-reject");
        if (!confirm("Reject this application?")) return;
        try {
          await api(`/api/org/bookings/${id}/reject`, { method: "POST", body: "{}" });
          show("ok", "Booking rejected.");
          await loadBookings();
        } catch (err) { show("error", err.message); }
      });
    });
 
    bookingsList.querySelectorAll("[data-rate]").forEach(btn => {
      btn.addEventListener("click", () => openRatingModal(btn.getAttribute("data-rate")));
    });
 
  } catch (err) {
    bookingsList.innerHTML = "";
    show("error", err.message);
  }
}
 
(async () => {
  await guard(["organisation", "admin"]);
  await loadBookings();
})();