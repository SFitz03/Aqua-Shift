const msg = document.getElementById("msg");

// Existing UI
const shiftsList = document.getElementById("shiftsList");
const statusFilter = document.getElementById("statusFilter");

// NEW UI
const bookingsList = document.getElementById("bookingsList");
const bookingStatusFilter = document.getElementById("bookingStatusFilter");

const dbsList = document.getElementById("dbsList");
const dbsFilter = document.getElementById("dbsFilter");

// Buttons / forms
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const refreshBookingsBtn = document.getElementById("refreshBookingsBtn");
const refreshDbsBtn = document.getElementById("refreshDbsBtn");
const demoBtn = document.getElementById("demoBtn");
const shiftForm = document.getElementById("shiftForm");

if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (refreshBtn) refreshBtn.addEventListener("click", loadMyShifts);
if (refreshBookingsBtn) refreshBookingsBtn.addEventListener("click", loadBookings);
if (refreshDbsBtn) refreshDbsBtn.addEventListener("click", loadDbsCandidates);

// ✅ filter listeners
if (statusFilter) statusFilter.addEventListener("change", loadMyShifts);
if (bookingStatusFilter) bookingStatusFilter.addEventListener("change", loadBookings);
if (dbsFilter) dbsFilter.addEventListener("change", loadDbsCandidates);

if (demoBtn) {
  demoBtn.addEventListener("click", () => {
    const title = document.getElementById("title");
    const shift_date = document.getElementById("shift_date");
    const start_time = document.getElementById("start_time");
    const end_time = document.getElementById("end_time");
    const level_required = document.getElementById("level_required");
    const pay_rate = document.getElementById("pay_rate");

    if (title) title.value = "Cover Instructor - Level 2";
    if (shift_date) shift_date.value = new Date().toISOString().slice(0, 10);
    if (start_time) start_time.value = "09:00";
    if (end_time) end_time.value = "12:00";
    if (level_required) level_required.value = "Level 2";
    if (pay_rate) pay_rate.value = "18.50";
  });
}

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

// ---------------------
// SHIFTS
// ---------------------
function shiftRow(s) {
  const when = `${fmtDate(s.shift_date)} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`;
  const canCancel = s.status !== "cancelled";

  return `
    <div class="item">
      <div class="item-main">
        <div class="item-title">#${s.id} • ${s.title}</div>
        <div class="item-sub muted">${when} • ${s.level_required} • £${s.pay_rate}/hr • <b>${s.status}</b></div>
      </div>
      <div class="item-actions">
        ${canCancel ? `<button class="btn danger" data-cancel-shift="${s.id}">Cancel</button>` : ""}
      </div>
    </div>
  `;
}

async function loadMyShifts() {
  if (!shiftsList) return;

  if (msg) msg.style.display = "none";
  shiftsList.innerHTML = `<div class="muted">Loading…</div>`;

  const status = statusFilter?.value || "";
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";

  try {
    const data = await api(`/api/org/shifts${qs}`);
    const shifts = data.shifts || [];

    if (!shifts.length) {
      shiftsList.innerHTML = `<div class="muted">No shifts found.</div>`;
      return;
    }

    shiftsList.innerHTML = shifts.map(shiftRow).join("");

    shiftsList.querySelectorAll("[data-cancel-shift]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-cancel-shift");
        if (!confirm(`Cancel shift #${id}? This cancels related bookings.`)) return;

        try {
          await api(`/api/shifts/${id}/cancel`, { method: "POST", body: "{}" });
          show("ok", `Shift #${id} cancelled.`);
          await loadMyShifts();
          await loadBookings();
          await loadDbsCandidates();
        } catch (err) {
          show("error", err.message);
        }
      });
    });
  } catch (err) {
    shiftsList.innerHTML = "";
    show("error", err.message);
  }
}

if (shiftForm) {
  shiftForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.style.display = "none";

    const title = document.getElementById("title")?.value.trim() || "";
    const shift_date = document.getElementById("shift_date")?.value || "";
    const start_time = document.getElementById("start_time")?.value || "";
    const end_time = document.getElementById("end_time")?.value || "";
    const level_required = document.getElementById("level_required")?.value.trim() || "";
    const pay_rate = document.getElementById("pay_rate")?.value || "";

    if (!title || !shift_date || !start_time || !end_time || !level_required || pay_rate === "") {
      show("error", "Please complete all fields.");
      return;
    }

    try {
      await api("/api/shifts", {
        method: "POST",
        body: JSON.stringify({ title, shift_date, start_time, end_time, level_required, pay_rate })
      });

      show("ok", "Shift posted.");
      e.target.reset();
      await loadMyShifts();
    } catch (err) {
      show("error", err.message);
    }
  });
}

// ---------------------
// BOOKINGS (ORG)
// ---------------------
function bookingRow(b) {
  const when = `${fmtDate(b.shift_date)} ${fmtTime(b.start_time)}–${fmtTime(b.end_time)}`;
  const bookingStatus = normStatus(b.booking_status);
  const dbsStatus = normStatus(b.dbs_status, "not_submitted");

  const statusBadge = `<span class="badge">${bookingStatus}</span>`;
  const dbsBadge = `<span class="badge">${dbsStatus}</span>`;

  const today = new Date().toISOString().slice(0, 10);
  const shiftDate = String(b.shift_date || "").slice(0, 10);
  const alreadyRated = !!b.rating_id;

  const canReject = bookingStatus === "requested";
  const canAccept = bookingStatus === "requested" && dbsStatus === "verified";
  const canRate = bookingStatus === "accepted" && shiftDate <= today && !alreadyRated;

  const acceptBtn = canAccept
    ? `<button class="btn primary" data-accept="${b.booking_id}">Accept</button>`
    : "";

  const rejectBtn = canReject
    ? `<button class="btn danger" data-reject="${b.booking_id}">Reject</button>`
    : "";

  const rateBtn = canRate
    ? `<button class="btn primary" data-rate="${b.booking_id}">Rate</button>`
    : "";

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
        <div class="item-title">Booking #${b.booking_id} ${statusBadge}</div>
        <div class="item-sub muted">
          Shift #${b.shift_id} • ${b.title} • ${when} • £${b.pay_rate}/hr
        </div>
        <div class="item-sub muted">
          Instructor: ${b.instructor_name} (${b.instructor_email}) • Level: ${b.qualification_level || "—"}
        </div>
        <div class="item-sub muted">
          DBS: ${dbsBadge}
        </div>
        ${acceptBlockedMsg}
        ${ratingInfo}
      </div>
      <div class="item-actions">
        ${acceptBtn}
        ${rejectBtn}
        ${rateBtn}
      </div>
    </div>
  `;
}

async function loadBookings() {
  if (!bookingsList) return;

  bookingsList.innerHTML = `<div class="muted">Loading…</div>`;
  if (msg) msg.style.display = "none";

  const st = bookingStatusFilter?.value || "";
  const qs = st ? `?status=${encodeURIComponent(st)}` : "";

  try {
    const data = await api(`/api/org/bookings${qs}`, { method: "GET" });
    const bookings = data.bookings || [];

    if (!bookings.length) {
      bookingsList.innerHTML = `<div class="muted">No bookings found.</div>`;
      return;
    }

    bookingsList.innerHTML = bookings.map(bookingRow).join("");

    bookingsList.querySelectorAll("[data-accept]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-accept");
        if (!confirm(`Accept booking #${id}? This fills the shift and rejects other requests.`)) return;

        try {
          await api(`/api/org/bookings/${id}/accept`, { method: "POST", body: "{}" });
          show("ok", `Booking #${id} accepted.`);
          await loadBookings();
          await loadMyShifts();
          await loadDbsCandidates();
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
          await api(`/api/org/bookings/${id}/reject`, { method: "POST", body: "{}" });
          show("ok", `Booking #${id} rejected.`);
          await loadBookings();
          await loadDbsCandidates();
        } catch (err) {
          show("error", err.message);
        }
      });
    });

    bookingsList.querySelectorAll("[data-rate]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-rate");

        const rating = prompt("Enter rating from 1 to 5:");
        if (!rating) return;

        const numeric = Number(rating);
        if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
          alert("Rating must be a whole number from 1 to 5.");
          return;
        }

        const comment = prompt("Feedback for the instructor:") || "";

        try {
          await api(`/api/org/bookings/${id}/rate`, {
            method: "POST",
            body: JSON.stringify({
              rating: numeric,
              comment
            })
          });

          show("ok", `Rating submitted for booking #${id}.`);
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

// ---------------------
// DBS (ORG)
// ---------------------
function dbsRow(b) {
  const status = normStatus(b.dbs_status);
  const badge = `<span class="badge">${status}</span>`;
  const canVerify = status === "pending";

  const verifyBtn = canVerify
    ? `<button class="btn primary" data-dbs-verify="${b.instructor_profile_id}">Verify</button>`
    : "";

  const rejectBtn = canVerify
    ? `<button class="btn danger" data-dbs-reject="${b.instructor_profile_id}">Reject</button>`
    : "";

  return `
    <div class="item">
      <div class="item-main">
        <div class="item-title">${b.instructor_name} ${badge}</div>
        <div class="item-sub muted">
          Instructor Profile #${b.instructor_profile_id} • ${b.instructor_email}
        </div>
        <div class="item-sub muted">
          Type: ${b.dbs_check_type || "—"} • Issued: ${fmtDate(b.dbs_issued_date)} • Update Service: ${b.update_service_member ? "Yes" : "No"} • Ref: ${b.dbs_ref_last4 || "—"}
        </div>
      </div>
      <div class="item-actions">
        ${verifyBtn}
        ${rejectBtn}
      </div>
    </div>
  `;
}

async function loadDbsCandidates() {
  if (!dbsList) return;

  dbsList.innerHTML = `<div class="muted">Loading…</div>`;
  if (msg) msg.style.display = "none";

  try {
    const data = await api(`/api/org/bookings`, { method: "GET" });
    let bookings = data.bookings || [];

    const selectedFilter = dbsFilter?.value || "";
    if (selectedFilter) {
      bookings = bookings.filter((b) => normStatus(b.dbs_status, "not_submitted") === selectedFilter);
    }

    const seen = new Set();
    const instructors = [];

    for (const b of bookings) {
      if (!b.instructor_profile_id) continue;
      if (seen.has(b.instructor_profile_id)) continue;
      seen.add(b.instructor_profile_id);
      instructors.push(b);
    }

    if (!instructors.length) {
      dbsList.innerHTML = `<div class="muted">No instructors to show.</div>`;
      return;
    }

    dbsList.innerHTML = instructors.map(dbsRow).join("");

    dbsList.querySelectorAll("[data-dbs-verify]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-dbs-verify");
        const notes = prompt("Optional notes (max 255 chars):", "") || "";

        try {
          await api(`/api/org/instructors/${id}/dbs/verify`, {
            method: "POST",
            body: JSON.stringify({ dbs_notes: notes })
          });
          show("ok", `Instructor #${id} DBS verified.`);
          await loadDbsCandidates();
          await loadBookings();
        } catch (err) {
          show("error", err.message);
        }
      });
    });

    dbsList.querySelectorAll("[data-dbs-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-dbs-reject");
        const notes = prompt("Reason/notes (max 255 chars):", "") || "";

        try {
          await api(`/api/org/instructors/${id}/dbs/reject`, {
            method: "POST",
            body: JSON.stringify({ dbs_notes: notes })
          });
          show("ok", `Instructor #${id} DBS rejected.`);
          await loadDbsCandidates();
          await loadBookings();
        } catch (err) {
          show("error", err.message);
        }
      });
    });
  } catch (err) {
    dbsList.innerHTML = "";
    show("error", err.message);
  }
}

(async () => {
  await guard(["organisation", "admin"]);
  await loadMyShifts();
  await loadBookings();
  await loadDbsCandidates();
})();