const msg = document.getElementById("msg");
const ratingsList = document.getElementById("ratingsList");
const filterStatus = document.getElementById("filterStatus");
const ratingModal = document.getElementById("ratingModal");
const starPicker = document.getElementById("starPicker");
const selectedRatingText = document.getElementById("selectedRating");
const ratingComment = document.getElementById("ratingComment");
const ratingSubtitle = document.getElementById("ratingSubtitle");
const submitRatingBtn = document.getElementById("submitRatingBtn");
const cancelRatingBtn = document.getElementById("cancelRatingBtn");
 
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", load);
filterStatus.addEventListener("change", load);
 
let activeBookingId = null;
let selectedRating = 0;
 
// ── Helpers ──────────────────────────────────────────────────────────────────
function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}
 
function fmtDate(d) {
  return String(d || "").slice(0, 10) || "—";
}
 
function fmtTime(t) {
  return String(t || "").slice(0, 5) || "—";
}
 
function starDisplay(value) {
  const full = Math.floor(value);
  const half = value % 1 !== 0;
  const empty = 5 - full - (half ? 1 : 0);
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}
 
// ── Star picker ───────────────────────────────────────────────────────────────
function renderStars(value) {
  const stars = starPicker.querySelectorAll("span");
  stars.forEach((star, i) => {
    const n = i + 1;
    star.textContent = value >= n ? "★" : value >= n - 0.5 ? "⯨" : "☆";
    star.style.color = value >= n - 0.5 ? "#00c9c8" : "var(--muted)";
  });
  selectedRatingText.textContent = value ? `Selected: ${value} / 5  ${starDisplay(value)}` : "Selected: —";
}
 
starPicker.querySelectorAll("span").forEach((star, index) => {
  star.addEventListener("mousemove", (e) => {
    const rect = star.getBoundingClientRect();
    const isHalf = e.clientX - rect.left < rect.width / 2;
    renderStars(index + (isHalf ? 0.5 : 1));
  });
  star.addEventListener("click", (e) => {
    const rect = star.getBoundingClientRect();
    const isHalf = e.clientX - rect.left < rect.width / 2;
    selectedRating = index + (isHalf ? 0.5 : 1);
    renderStars(selectedRating);
  });
});
 
starPicker.addEventListener("mouseleave", () => renderStars(selectedRating));
 
// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(bookingId, instructorName, shiftTitle, shiftDate) {
  activeBookingId = bookingId;
  selectedRating = 0;
  ratingComment.value = "";
  renderStars(0);
  ratingSubtitle.textContent = `${instructorName} • ${shiftTitle} • ${shiftDate}`;
  ratingModal.style.display = "flex";
}
 
function closeModal() {
  activeBookingId = null;
  selectedRating = 0;
  ratingModal.style.display = "none";
}
 
cancelRatingBtn.addEventListener("click", closeModal);
ratingModal.addEventListener("click", (e) => { if (e.target === ratingModal) closeModal(); });
 
submitRatingBtn.addEventListener("click", async () => {
  if (!activeBookingId) return;
  if (!selectedRating) {
    show("error", "Please select a star rating before submitting.");
    return;
  }
 
  try {
    submitRatingBtn.disabled = true;
    await api(`/api/org/bookings/${activeBookingId}/rate`, {
      method: "POST",
      body: JSON.stringify({
        rating: selectedRating,
        comment: ratingComment.value.trim() || ""
      })
    });
 
    show("ok", `Rating submitted successfully.`);
    closeModal();
    await load();
  } catch (err) {
    show("error", err.message);
  } finally {
    submitRatingBtn.disabled = false;
  }
});
 
// ── Render a booking card ─────────────────────────────────────────────────────
function bookingCard(b) {
  const when = `${fmtDate(b.shift_date)} • ${fmtTime(b.start_time)}–${fmtTime(b.end_time)}`;
  const alreadyRated = !!b.rating_id;
  const dbsStatus = String(b.dbs_status || "").toLowerCase();
 
  const ratingBlock = alreadyRated
    ? `<div style="margin-top:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:rgba(0,201,200,0.05);">
         <div style="color:var(--accent);font-size:1.1rem;letter-spacing:2px;">${starDisplay(b.rating)}</div>
         <div style="color:var(--text);font-size:.88rem;margin-top:4px;"><strong>${b.rating}/5</strong>${b.comment ? ` — ${b.comment}` : ""}</div>
       </div>`
    : `<button class="btn primary" style="margin-top:10px;" data-rate="${b.booking_id}"
         data-name="${escHtml(b.instructor_name)}"
         data-title="${escHtml(b.title)}"
         data-date="${fmtDate(b.shift_date)}">
         ★ Rate this instructor
       </button>`;
 
  return `
    <div class="item" style="flex-direction:column;align-items:flex-start;">
      <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
        <div>
          <div class="item-title" style="font-size:1rem;">
            ${escHtml(b.instructor_name)}
            <span class="badge" style="font-size:.75rem;margin-left:6px;">${escHtml(b.qualification_level || "—")}</span>
            ${dbsStatus === "verified" ? `<span class="badge" style="color:var(--ok);border-color:rgba(53,208,127,0.35);font-size:.75rem;">✓ DBS verified</span>` : ""}
          </div>
          <div class="item-sub muted" style="margin-top:4px;">
            ${escHtml(b.title)} • ${when} • £${b.pay_rate}/hr
          </div>
          <div class="item-sub muted">
            Booking #${b.booking_id} • ${escHtml(b.instructor_email)}
          </div>
        </div>
        <div style="text-align:right;">
          ${alreadyRated
            ? `<span class="pill accepted">Rated</span>`
            : `<span class="pill open">Awaiting rating</span>`}
        </div>
      </div>
      ${ratingBlock}
    </div>
  `;
}
 
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
 
// ── Load ──────────────────────────────────────────────────────────────────────
async function load() {
  msg.style.display = "none";
  ratingsList.innerHTML = `<div class="muted">Loading…</div>`;
 
  try {
    const data = await api("/api/org/bookings", { method: "GET" });
    let bookings = (data.bookings || []).filter(
      (b) => String(b.booking_status).toLowerCase() === "accepted"
    );
 
    const filter = filterStatus.value;
    if (filter === "pending") bookings = bookings.filter((b) => !b.rating_id);
    if (filter === "rated") bookings = bookings.filter((b) => !!b.rating_id);
 
    // Sort: unrated first, then by shift date descending
    bookings.sort((a, b) => {
      if (!!a.rating_id !== !!b.rating_id) return a.rating_id ? 1 : -1;
      return new Date(b.shift_date) - new Date(a.shift_date);
    });
 
    if (!bookings.length) {
      ratingsList.innerHTML = `<div class="muted">No ${filter === "pending" ? "unrated" : filter === "rated" ? "rated" : ""} bookings found.</div>`;
      return;
    }
 
    ratingsList.innerHTML = bookings.map(bookingCard).join("");
 
    ratingsList.querySelectorAll("[data-rate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openModal(
          btn.getAttribute("data-rate"),
          btn.getAttribute("data-name"),
          btn.getAttribute("data-title"),
          btn.getAttribute("data-date")
        );
      });
    });
  } catch (err) {
    ratingsList.innerHTML = "";
    show("error", err.message);
  }
}
 
(async () => {
  await guard(["organisation", "admin"]);
  await load();
})();