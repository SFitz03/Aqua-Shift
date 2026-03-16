const msg = document.getElementById("msg");
const bookingsList = document.getElementById("bookingsList");
const statusFilter = document.getElementById("statusFilter");

const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");

// Rating modal elements
const ratingModal = document.getElementById("ratingModal");
const starPicker = document.getElementById("starPicker");
const selectedRatingText = document.getElementById("selectedRating");
const ratingComment = document.getElementById("ratingComment");
const submitRatingBtn = document.getElementById("submitRatingBtn");
const cancelRatingBtn = document.getElementById("cancelRatingBtn");

let activeBookingId = null;
let selectedRating = 0;

if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (refreshBtn) refreshBtn.addEventListener("click", loadBookings);
if (statusFilter) statusFilter.addEventListener("change", loadBookings);

function show(type, text) {
  if (!msg) return;
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

function normStatus(v, fallback = "unknown") {
  return String(v || fallback).toLowerCase();
}

function starText(value) {
  const full = Math.floor(value);
  const half = value % 1 !== 0;
  const empty = 5 - full - (half ? 1 : 0);
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

function renderStarPicker(value) {
  if (!starPicker) return;

  const stars = starPicker.querySelectorAll("span");
  stars.forEach((star, index) => {
    const starNumber = index + 1;

    if (value >= starNumber) {
      star.textContent = "★";
    } else if (value >= starNumber - 0.5) {
      star.textContent = "⯨";
    } else {
      star.textContent = "☆";
    }
  });

  if (selectedRatingText) {
    selectedRatingText.textContent = value
      ? `Selected: ${value} / 5 ${starText(value)}`
      : "Selected: —";
  }
}

function openRatingModal(bookingId) {
  activeBookingId = bookingId;
  selectedRating = 0;
  if (ratingComment) ratingComment.value = "";
  renderStarPicker(0);
  if (ratingModal) ratingModal.style.display = "block";
}

function closeRatingModal() {
  activeBookingId = null;
  selectedRating = 0;
  if (ratingComment) ratingComment.value = "";
  if (ratingModal) ratingModal.style.display = "none";
}

if (starPicker) {
  const stars = starPicker.querySelectorAll("span");

  stars.forEach((star, index) => {
    star.addEventListener("mousemove", (e) => {
      const rect = star.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const isHalf = x < rect.width / 2;
      const hoverValue = index + (isHalf ? 0.5 : 1);
      renderStarPicker(hoverValue);
    });

    star.addEventListener("click", (e) => {
      const rect = star.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const isHalf = x < rect.width / 2;
      selectedRating = index + (isHalf ? 0.5 : 1);
      renderStarPicker(selectedRating);
    });
  });

  starPicker.addEventListener("mouseleave", () => {
    renderStarPicker(selectedRating);
  });
}

if (cancelRatingBtn) {
  cancelRatingBtn.addEventListener("click", closeRatingModal);
}

if (submitRatingBtn) {
  submitRatingBtn.addEventListener("click", async () => {
    if (!activeBookingId) return;

    if (!selectedRating) {
      alert("Please select a star rating.");
      return;
    }

    try {
      await api(`/api/org/bookings/${activeBookingId}/rate`, {
        method: "POST",
        body: JSON.stringify({
          rating: selectedRating,
          comment: ratingComment?.value?.trim() || ""
        })
      });

      show("ok", `Rating submitted for booking #${activeBookingId}.`);
      closeRatingModal();
      await loadBookings();
    } catch (err) {
      show("error", err.message);
    }
  });
}

function row(b) {
  const when = `${fmtDate(b.shift_date)} ${fmtTime(b.start_time)}–${fmtTime(b.end_time)}`;

  const bookingStatus = normStatus(b.booking_status);
  const shiftStatus = normStatus(b.shift_status);
  const dbsStatus = normStatus(b.dbs_status, b.dbs_checked ? "verified" : "not verified");

  const alreadyRated = !!b.rating_id;

  const canAccept = bookingStatus === "requested" && shiftStatus === "open" && dbsStatus === "verified";
  const canReject = bookingStatus === "requested";
  const canRate = bookingStatus === "accepted" && !alreadyRated;

  const acceptBlockedMsg =
    bookingStatus === "requested" && dbsStatus !== "verified"
      ? `<div class="item-sub muted">Cannot accept until DBS is <b>verified</b>.</div>`
      : "";

  const ratingInfo = alreadyRated
    ? `<div class="item-sub muted">Rating: <b>${b.rating}/5</b> • ${b.comment || "No comment"}</div>`
    : "";

  return `
    <div class="item">
      <div class="item-main">
        <div class="item-title">
          Booking #${b.booking_id}
          <span class="badge">${bookingStatus}</span>
          <span class="badge">${shiftStatus}</span>
        </div>
        <div class="item-sub muted">
          Shift #${b.shift_id} • ${b.title} • ${when} • £${b.pay_rate}/hr
        </div>
        <div class="item-sub muted">
          Instructor: <b>${b.instructor_name}</b> (${b.instructor_email}) • ${b.qualification_level || "—"} • DBS: ${dbsStatus}
        </div>
        ${acceptBlockedMsg}
        ${ratingInfo}
      </div>

      <div class="item-actions">
        ${canAccept ? `<button class="btn primary" data-accept="${b.booking_id}">Accept</button>` : ``}
        ${canReject ? `<button class="btn danger" data-reject="${b.booking_id}">Reject</button>` : ``}
        ${canRate ? `<button class="btn primary" data-rate="${b.booking_id}">Rate</button>` : ``}
      </div>
    </div>
  `;
}

async function loadBookings() {
  if (!bookingsList) return;

  if (msg) msg.style.display = "none";
  bookingsList.innerHTML = `<div class="muted">Loading…</div>`;

  try {
    const data = await api("/api/org/bookings", { method: "GET" });
    let bookings = data.bookings || [];

    const st = statusFilter?.value || "";
    if (st) bookings = bookings.filter((b) => normStatus(b.booking_status) === st);

    if (!bookings.length) {
      bookingsList.innerHTML = `<div class="muted">No bookings found.</div>`;
      return;
    }

    bookingsList.innerHTML = bookings.map(row).join("");

    bookingsList.querySelectorAll("[data-accept]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-accept");
        if (!confirm(`Accept booking #${id}? This will fill the shift.`)) return;

        try {
          await api(`/api/org/bookings/${id}/accept`, {
            method: "POST",
            body: "{}"
          });
          show("ok", `Accepted booking #${id}.`);
          await loadBookings();
        } catch (err) {
          show("error", err.message);
        }
      });
    });

    bookingsList.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-reject");
        if (!confirm(`Reject booking #${id}?`)) return;

        try {
          await api(`/api/org/bookings/${id}/reject`, {
            method: "POST",
            body: "{}"
          });
          show("ok", `Rejected booking #${id}.`);
          await loadBookings();
        } catch (err) {
          show("error", err.message);
        }
      });
    });

    bookingsList.querySelectorAll("[data-rate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-rate");
        openRatingModal(id);
      });
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