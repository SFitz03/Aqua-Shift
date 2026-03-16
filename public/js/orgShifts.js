const msg = document.getElementById("msg");
const shiftsList = document.getElementById("shiftsList");
const statusFilter = document.getElementById("statusFilter");

const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const demoBtn = document.getElementById("demoBtn");
const shiftForm = document.getElementById("shiftForm");

if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (refreshBtn) refreshBtn.addEventListener("click", loadMyShifts);
if (statusFilter) statusFilter.addEventListener("change", loadMyShifts);

if (demoBtn) {
  demoBtn.addEventListener("click", () => {
    const title = document.getElementById("title");
    const shiftDate = document.getElementById("shift_date");
    const startTime = document.getElementById("start_time");
    const endTime = document.getElementById("end_time");
    const levelRequired = document.getElementById("level_required");
    const payRate = document.getElementById("pay_rate");

    if (title) title.value = "Cover Instructor - Level 2";
    if (shiftDate) shiftDate.value = new Date().toISOString().slice(0, 10);
    if (startTime) startTime.value = "09:00";
    if (endTime) endTime.value = "12:00";
    if (levelRequired) levelRequired.value = "Level 2";
    if (payRate) payRate.value = "18.50";
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
          await api(`/api/shifts/${id}/cancel`, {
            method: "POST",
            body: "{}"
          });
          show("ok", `Shift #${id} cancelled.`);
          await loadMyShifts();
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
        body: JSON.stringify({
          title,
          shift_date,
          start_time,
          end_time,
          level_required,
          pay_rate
        })
      });

      show("ok", "Shift posted.");
      e.target.reset();
      await loadMyShifts();
    } catch (err) {
      show("error", err.message);
    }
  });
}

(async () => {
  await guard(["organisation", "admin"]);
  await loadMyShifts();
})();