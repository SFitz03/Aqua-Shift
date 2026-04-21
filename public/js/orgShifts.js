const msg = document.getElementById("msg");
const shiftsList = document.getElementById("shiftsList");
const statusFilter = document.getElementById("statusFilter");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const demoBtn = document.getElementById("demoBtn");
const shiftForm = document.getElementById("shiftForm");
const submitBtn = document.getElementById("submitBtn");
const previewMapBtn = document.getElementById("previewMapBtn");
const mapPreview = document.getElementById("mapPreview");
const mapFrame = document.getElementById("mapFrame");
 
if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (refreshBtn) refreshBtn.addEventListener("click", loadMyShifts);
if (statusFilter) statusFilter.addEventListener("change", loadMyShifts);
 
// Map preview
if (previewMapBtn) {
  previewMapBtn.addEventListener("click", () => {
    const postcode = document.getElementById("postcode").value.trim();
    if (!postcode) { show("error", "Enter a postcode first."); return; }
    const encoded = encodeURIComponent(postcode + ", UK");
    mapFrame.src = `https://maps.google.com/maps?q=${encoded}&output=embed&z=14`;
    mapPreview.style.display = "block";
  });
}
 
// Prefill demo
if (demoBtn) {
  demoBtn.addEventListener("click", () => {
    document.getElementById("title").value = "Cover Instructor – Level 2";
    document.getElementById("session_type").value = "Children's lessons";
    document.getElementById("shift_date").value = new Date().toISOString().slice(0, 10);
    document.getElementById("start_time").value = "09:00";
    document.getElementById("end_time").value = "12:00";
    document.getElementById("level_required").value = "Level 2";
    document.getElementById("min_dbs_type").value = "enhanced";
    document.getElementById("instructors_needed").value = "1";
    document.getElementById("pay_rate").value = "18.50";
    document.getElementById("postcode").value = "BS16 1QY";
    document.getElementById("description").value = "Please bring your own whistle. Lane 3 only.";
    document.getElementById("directions").value = "Enter via the back gate. Ask for reception. Parking in bay 3.";
    document.getElementById("expenses_included").value = "0";
    document.getElementById("is_urgent").checked = false;
  });
}
 
function show(type, text) {
  if (!msg) return;
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}
 
function fmtDate(d) { return String(d || "").slice(0, 10) || "—"; }
function fmtTime(t) { return String(t || "").slice(0, 5) || "—"; }
function esc(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
 
function shiftRow(s) {
  const when = `${fmtDate(s.shift_date)} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`;
  const canCancel = s.status !== "cancelled" && s.status !== "filled";
  const urgentBadge = s.is_urgent ? `<span style="color:var(--danger);font-weight:700;font-size:12px;margin-left:6px;">URGENT</span>` : "";
  const expensesBadge = s.expenses_included ? `<span class="badge" style="font-size:11px;margin-left:4px;">Expenses incl.</span>` : "";
 
  return `
    <div class="item" style="flex-direction:column;align-items:flex-start;">
      <div style="display:flex;justify-content:space-between;width:100%;flex-wrap:wrap;gap:6px;">
        <div>
          <div class="item-title">#${s.id} • ${esc(s.title)}${urgentBadge}</div>
          <div class="item-sub muted">${when} • ${esc(s.level_required)} • £${s.pay_rate}/hr${expensesBadge}</div>
          ${s.session_type ? `<div class="item-sub muted">Session: ${esc(s.session_type)}</div>` : ""}
          ${s.postcode ? `<div class="item-sub muted">📍 ${esc(s.postcode)}</div>` : ""}
          ${s.min_dbs_type ? `<div class="item-sub muted">Min DBS: ${esc(s.min_dbs_type)}</div>` : ""}
          ${s.instructors_needed > 1 ? `<div class="item-sub muted">Instructors needed: ${s.instructors_needed}</div>` : ""}
          ${s.description ? `<div class="item-sub muted" style="margin-top:4px;font-style:italic;">${esc(s.description)}</div>` : ""}
          ${s.directions ? `<div class="item-sub muted" style="margin-top:2px;">🗺️ ${esc(s.directions)}</div>` : ""}
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <span class="pill ${s.status}">${esc(s.status)}</span>
          ${canCancel ? `<button class="btn danger" data-cancel-shift="${s.id}">Cancel</button>` : ""}
        </div>
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
    const session_type = document.getElementById("session_type")?.value || "";
    const shift_date = document.getElementById("shift_date")?.value || "";
    const start_time = document.getElementById("start_time")?.value || "";
    const end_time = document.getElementById("end_time")?.value || "";
    const level_required = document.getElementById("level_required")?.value || "";
    const min_dbs_type = document.getElementById("min_dbs_type")?.value || "";
    const instructors_needed = document.getElementById("instructors_needed")?.value || "1";
    const pay_rate = document.getElementById("pay_rate")?.value || "";
    const postcode = document.getElementById("postcode")?.value.trim() || "";
    const description = document.getElementById("description")?.value.trim() || "";
    const directions = document.getElementById("directions")?.value.trim() || "";
    const expenses_included = document.getElementById("expenses_included")?.value === "1";
    const is_urgent = document.getElementById("is_urgent")?.checked || false;
 
    if (!title || !session_type || !shift_date || !start_time || !end_time || !level_required || pay_rate === "") {
      show("error", "Please complete all required fields.");
      return;
    }
 
    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";
 
    try {
      await api("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          title, session_type, shift_date, start_time, end_time,
          level_required, min_dbs_type, instructors_needed,
          pay_rate, postcode, description, directions, expenses_included, is_urgent
        })
      });
 
      show("ok", "Shift posted successfully.");
      shiftForm.reset();
      mapPreview.style.display = "none";
      await loadMyShifts();
    } catch (err) {
      show("error", err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Post Shift";
    }
  });
}
 
(async () => {
  await guard(["organisation", "admin"]);
  await loadMyShifts();
})();