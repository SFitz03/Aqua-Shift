const rowsEl = document.getElementById("rows");
const msg = document.getElementById("msg");

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", load);

function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function fmtDate(d) {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

function normStatus(v, fallback = "") {
  return String(v || fallback).toLowerCase();
}

function bookingBadge(status) {
  const s = normStatus(status, "unknown");
  return `<span class="pill">${escapeHtml(s)}</span>`;
}

function actionCell(booking) {
  if (!booking) {
    return `<button class="btn primary" data-apply>Apply</button>`;
  }

  const status = normStatus(booking.booking_status);

  if (status === "requested") {
    return `
      <div class="muted" style="margin-bottom:6px;">Already applied</div>
      ${bookingBadge("requested")}
    `;
  }

  if (status === "accepted") {
    return `
      <div class="muted" style="margin-bottom:6px;">Accepted</div>
      ${bookingBadge("accepted")}
    `;
  }

  if (status === "rejected") {
    return `
      <div class="muted" style="margin-bottom:6px;">Application rejected</div>
      ${bookingBadge("rejected")}
    `;
  }

  if (status === "cancelled") {
    return `
      <div class="muted" style="margin-bottom:6px;">Previous application cancelled</div>
      <button class="btn primary" data-apply>Apply again</button>
    `;
  }

  return bookingBadge(status);
}

async function load() {
  msg.style.display = "none";
  rowsEl.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;

  try {
    const [shiftsData, bookingsData] = await Promise.all([
      api("/api/shifts?status=open", { method: "GET" }),
      api("/api/instructor/bookings", { method: "GET" })
    ]);

    const shifts = shiftsData?.shifts || [];
    const bookings = bookingsData?.bookings || [];

    // Map bookings by shift_id for quick lookup
    const bookingByShiftId = new Map();
    for (const b of bookings) {
      if (!b.shift_id) continue;

      const existing = bookingByShiftId.get(b.shift_id);

      // Keep the most relevant status if there are multiple records
      // priority: accepted > requested > rejected > cancelled
      const rank = { accepted: 4, requested: 3, rejected: 2, cancelled: 1 };
      const currentRank = rank[normStatus(b.booking_status)] || 0;
      const existingRank = existing ? (rank[normStatus(existing.booking_status)] || 0) : 0;

      if (!existing || currentRank > existingRank) {
        bookingByShiftId.set(b.shift_id, b);
      }
    }

    if (shifts.length === 0) {
      rowsEl.innerHTML = `<tr><td colspan="6" class="muted">No open shifts right now.</td></tr>`;
      return;
    }

    rowsEl.innerHTML = shifts.map((s) => {
      const booking = bookingByShiftId.get(s.id);

      return `
        <tr>
          <td>
            <div><strong>${escapeHtml(s.title)}</strong></div>
            <div class="muted">Shift ID: ${s.id} • Org ID: ${s.organisation_id}</div>
          </td>
          <td>
            <div>${fmtDate(s.shift_date)}</div>
            <div class="muted">${escapeHtml(String(s.start_time))} → ${escapeHtml(String(s.end_time))}</div>
          </td>
          <td>${escapeHtml(s.level_required)}</td>
          <td>£${escapeHtml(String(s.pay_rate))}/hr</td>
          <td><span class="pill open">${escapeHtml(s.status)}</span></td>
          <td style="white-space:nowrap;" data-actions-for="${s.id}">
            ${actionCell(booking)}
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll("[data-actions-for]").forEach((cell) => {
      const shiftId = cell.getAttribute("data-actions-for");
      const btn = cell.querySelector("[data-apply]");
      if (!btn) return;

      btn.addEventListener("click", async () => {
        btn.disabled = true;

        try {
          const out = await api(`/api/shifts/${shiftId}/apply`, {
            method: "POST",
            body: "{}"
          });

          show("ok", `Applied successfully. Booking id: ${out.booking_id}`);
          await load();
        } catch (err) {
          show("error", err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    show("error", err.message);
    rowsEl.innerHTML = `<tr><td colspan="6" class="muted">Failed to load shifts.</td></tr>`;
  }
}

(async () => {
  await guard(["instructor", "admin"]);
  await load();
})();