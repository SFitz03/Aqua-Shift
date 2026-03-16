const msg = document.getElementById("msg");
const bookingsList = document.getElementById("bookingsList");
const statusFilter = document.getElementById("statusFilter");

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", loadBookings);

// ✅ auto-refresh when filter changes
if (statusFilter) statusFilter.addEventListener("change", loadBookings);

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

function normStatus(v, fallback = "") {
  return String(v || fallback).toLowerCase();
}

function bookingStatusText(status) {
  const s = normStatus(status, "unknown");

  if (s === "requested") return "Application submitted";
  if (s === "accepted") return "Accepted";
  if (s === "rejected") return "Rejected";
  if (s === "cancelled") return "Cancelled";
  return s;
}

function row(b) {
  const when = `${fmtDate(b.shift_date)} ${fmtTime(b.start_time)}–${fmtTime(b.end_time)}`;
  const bookingStatus = normStatus(b.booking_status);
  const canCancel = bookingStatus === "requested";

  return `
    <div class="item">
      <div class="item-main">
        <div class="item-title">
          Booking #${b.booking_id} <span class="badge">${bookingStatus}</span>
        </div>
        <div class="item-sub muted">
          Shift #${b.shift_id} • ${b.title} • ${when} • £${b.pay_rate}/hr • <b>${b.shift_status}</b>
        </div>
        <div class="item-sub muted">
          Organisation: ${b.organisation_name} • ${b.organisation_postcode} • ${b.contact_phone}
        </div>
        <div class="item-sub muted">
          Status: ${bookingStatusText(bookingStatus)}
        </div>
      </div>
      <div class="item-actions">
        ${canCancel ? `<button class="btn danger" data-cancel="${b.booking_id}">Cancel</button>` : ``}
      </div>
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
    if (st) bookings = bookings.filter((b) => normStatus(b.booking_status) === st);

    // optional: newest first
    bookings.sort((a, b) => Number(b.booking_id) - Number(a.booking_id));

    if (!bookings.length) {
      bookingsList.innerHTML = `<div class="muted">No applications found.</div>`;
      return;
    }

    bookingsList.innerHTML = bookings.map(row).join("");

    bookingsList.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-cancel");
        if (!confirm(`Cancel booking #${id}?`)) return;

        try {
          await api(`/api/bookings/${id}/cancel`, { method: "POST", body: "{}" });
          show("ok", `Booking #${id} cancelled.`);
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