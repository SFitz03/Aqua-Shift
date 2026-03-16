const msg = document.getElementById("msg");
const openShiftsList = document.getElementById("openShiftsList");
const myBookingsList = document.getElementById("myBookingsList");

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshShiftsBtn").addEventListener("click", loadOpenShifts);
document.getElementById("refreshBookingsBtn").addEventListener("click", loadMyBookings);

function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}

function fmtDate(d) {
  // API returns ISO string sometimes; keep it simple
  return String(d).slice(0, 10);
}

function fmtTime(t) {
  return String(t).slice(0, 5);
}

function shiftRow(s, appliedStatus = null) {
  const when = `${fmtDate(s.shift_date)} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`;

  let badge = "";
  let btn = `<button class="btn primary" data-apply="${s.id}">Apply</button>`;

  if (appliedStatus) {
    badge = `<span class="badge">${appliedStatus}</span>`;
    btn = `<button class="btn" disabled>Applied</button>`;
  }

  return `
    <div class="item">
      <div class="item-main">
        <div class="item-title">#${s.id} • ${s.title} ${badge}</div>
        <div class="item-sub muted">${when} • ${s.level_required} • £${s.pay_rate}/hr</div>
      </div>
      <div class="item-actions">${btn}</div>
    </div>
  `;
}

function bookingRow(b) {
  const when = `${fmtDate(b.shift_date)} ${fmtTime(b.start_time)}–${fmtTime(b.end_time)}`;
  const status = b.booking_status;

  const canCancel = status === "requested";
  const cancelBtn = canCancel
    ? `<button class="btn danger" data-cancel-booking="${b.booking_id}">Cancel</button>`
    : "";

  return `
    <div class="item">
      <div class="item-main">
        <div class="item-title">Booking #${b.booking_id} • Shift #${b.shift_id} • <span class="badge">${status}</span></div>
        <div class="item-sub muted">
          ${b.title} • ${when} • £${b.pay_rate}/hr • ${b.organisation_name}
        </div>
      </div>
      <div class="item-actions">${cancelBtn}</div>
    </div>
  `;
}

async function loadMyBookings() {
  myBookingsList.innerHTML = `<div class="muted">Loading…</div>`;
  try {
    const data = await api("/api/instructor/bookings", { method: "GET" });
    const bookings = data.bookings || [];

    if (!bookings.length) {
      myBookingsList.innerHTML = `<div class="muted">No bookings yet.</div>`;
      return bookings;
    }

    myBookingsList.innerHTML = bookings.map(bookingRow).join("");

    // wire cancel buttons
    myBookingsList.querySelectorAll("[data-cancel-booking]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-cancel-booking");
        if (!confirm(`Cancel booking #${id}?`)) return;

        try {
          await api(`/api/bookings/${id}/cancel`, { method: "POST", body: "{}" });
          show("ok", `Booking #${id} cancelled.`);
          await loadMyBookings();
          await loadOpenShifts(); // refresh applied badges
        } catch (err) {
          show("error", err.message);
        }
      });
    });

    return bookings;
  } catch (err) {
    myBookingsList.innerHTML = "";
    show("error", err.message);
    return [];
  }
}

async function loadOpenShifts() {
  openShiftsList.innerHTML = `<div class="muted">Loading…</div>`;
  msg.style.display = "none";

  try {
    // Load bookings first so we can show "Requested/Accepted" badges per shift
    const bookingsData = await api("/api/instructor/bookings", { method: "GET" });
    const bookings = bookingsData.bookings || [];

    // Map shift_id -> booking_status (prefer accepted > requested > rejected/cancelled)
    const statusPriority = { accepted: 3, requested: 2, rejected: 1, cancelled: 0 };
    const bookingByShift = new Map();

    for (const b of bookings) {
      const current = bookingByShift.get(b.shift_id);
      if (!current) bookingByShift.set(b.shift_id, b.booking_status);
      else {
        if ((statusPriority[b.booking_status] || 0) > (statusPriority[current] || 0)) {
          bookingByShift.set(b.shift_id, b.booking_status);
        }
      }
    }

    const shiftsData = await api("/api/shifts?status=open", { method: "GET" });
    const shifts = shiftsData.shifts || [];

    if (!shifts.length) {
      openShiftsList.innerHTML = `<div class="muted">No open shifts right now.</div>`;
      return;
    }

    openShiftsList.innerHTML = shifts
      .map((s) => shiftRow(s, bookingByShift.get(s.id) || null))
      .join("");

    // wire apply buttons
    openShiftsList.querySelectorAll("[data-apply]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const shiftId = btn.getAttribute("data-apply");
        if (!confirm(`Apply for shift #${shiftId}?`)) return;

        try {
          await api(`/api/shifts/${shiftId}/apply`, { method: "POST", body: "{}" });
          show("ok", `Applied to shift #${shiftId}.`);
          await loadMyBookings();
          await loadOpenShifts();
        } catch (err) {
          show("error", err.message);
        }
      });
    });
  } catch (err) {
    openShiftsList.innerHTML = "";
    show("error", err.message);
  }
}

(async () => {
  await guard(["instructor", "admin"]);
  await loadMyBookings();
  await loadOpenShifts();
})();