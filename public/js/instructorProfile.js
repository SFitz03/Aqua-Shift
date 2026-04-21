const msg = document.getElementById("msg");
const dbsBox = document.getElementById("dbsBox");
const ratingsSummary = document.getElementById("ratingsSummary");
const ratingsList = document.getElementById("ratingsList");

document.getElementById("logoutBtn").addEventListener("click", logout);

document.getElementById("demoProfileBtn").addEventListener("click", () => {
  document.getElementById("qualification_level").value = "Level 2";
  document.getElementById("postcode").value = "BS16 1QY";
  document.getElementById("bio").value =
    "Experienced swim instructor focused on safe, confident progression.";
  document.getElementById("availability_days").value = "Mon,Tue,Thu";
  document.getElementById("availability_start").value = "09:00";
  document.getElementById("availability_end").value = "17:00";
});

document.getElementById("demoDbsBtn").addEventListener("click", () => {
  document.getElementById("dbs_check_type").value = "enhanced";
  document.getElementById("dbs_issued_date").value = "2025-11-01";

  // FIX: if update_service_member is a checkbox, tick it properly
  const us = document.getElementById("update_service_member");
  if (us) {
    if (us.type === "checkbox") us.checked = true;
    else us.value = "1"; // fallback if it’s a select/input
  }

  document.getElementById("dbs_ref_last4").value = "1234";
});

function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}

function fmtDate(d) {
  if (!d) return "—";
  return String(d).slice(0, 10);
}

function stars(n) {
  const x = Number(n) || 0;
  return "★".repeat(x) + "☆".repeat(5 - x);
}

function renderDbs(dbs) {
  if (!dbs) return `<div class="muted">No DBS data yet.</div>`;

  return `
    <div>
      <div><b>Status:</b> <span class="badge">${dbs.dbs_status || "unknown"}</span></div>
      <div class="muted" style="margin-top:6px;">
        <div><b>Checked:</b> ${dbs.dbs_checked ? "Yes" : "No"}</div>
        <div><b>Type:</b> ${dbs.dbs_check_type || "—"}</div>
        <div><b>Issued:</b> ${fmtDate(dbs.dbs_issued_date)}</div>
        <div><b>Update Service:</b> ${dbs.update_service_member ? "Yes" : "No"}</div>
        <div><b>Ref last4:</b> ${dbs.dbs_ref_last4 || "—"}</div>
        <div><b>Verified at:</b> ${fmtDate(dbs.dbs_verified_at)}</div>
      </div>
    </div>
  `;
}

function renderRatingsSummary(summary) {
  if (!summary || !summary.total_ratings) {
    return `
      <div><b>Average rating:</b> —</div>
      <div><b>Total ratings:</b> 0</div>
    `;
  }

  return `
    <div><b>Average rating:</b> ${summary.average_rating} / 5</div>
    <div><b>Total ratings:</b> ${summary.total_ratings}</div>
  `;
}

function renderRatingsList(ratings) {
  if (!ratings || !ratings.length) {
    return `<div class="muted">No ratings yet.</div>`;
  }

  return ratings.map((r) => `
    <div class="item">
      <div class="item-main">
        <div class="item-title">${r.organisation_name} • ${stars(r.rating)} (${r.rating}/5)</div>
        <div class="item-sub muted">
          ${r.title} • ${fmtDate(r.shift_date)}
        </div>
        <div class="item-sub">
          ${r.comment || "No written feedback."}
        </div>
      </div>
    </div>
  `).join("");
}

// added a new UI rules based on dbs_status
function applyDbsUiRules(dbs) {
  const status = (dbs?.dbs_status || "not_submitted").toLowerCase();

  const dbsForm = document.getElementById("dbsForm");
  const demoDbsBtn = document.getElementById("demoDbsBtn");

  if (!dbsForm) return;

  // Default: show form + demo button
  dbsForm.style.display = "block";
  if (demoDbsBtn) demoDbsBtn.style.display = "inline-block";

  // Behaviour by status
  if (status === "verified") {
    // Verified: hide form completely
    dbsForm.style.display = "none";
    if (demoDbsBtn) demoDbsBtn.style.display = "none";
    return;
  }

  const inputs = dbsForm.querySelectorAll("input, select, textarea, button");

  if (status === "pending") {
    // Pending: disable all inputs + submit
    inputs.forEach((el) => (el.disabled = true));
    show(
      "ok",
      "Your DBS is pending verification. You can’t edit it until an organisation/admin reviews it."
    );
  } else {
    // not_submitted / rejected / unknown -> enable inputs
    inputs.forEach((el) => (el.disabled = false));
  }
}

async function loadDbs() {
  try {
    const data = await api("/api/instructor/dbs/me", { method: "GET" });
    dbsBox.innerHTML = renderDbs(data.dbs);
    applyDbsUiRules(data.dbs);
  } catch (err) {
    dbsBox.innerHTML = `<div class="muted">${err.message}</div>`;
    applyDbsUiRules(null);
  }
}

async function loadRatings() {
  if (!ratingsSummary || !ratingsList) return;

  ratingsSummary.innerHTML = "Loading rating summary…";
  ratingsList.innerHTML = `<div class="muted">Loading ratings…</div>`;

  try {
    const [summaryData, ratingsData] = await Promise.all([
      api("/api/instructor/ratings/summary", { method: "GET" }),
      api("/api/instructor/ratings", { method: "GET" })
    ]);

    ratingsSummary.innerHTML = renderRatingsSummary(summaryData.summary);
    ratingsList.innerHTML = renderRatingsList(ratingsData.ratings || []);
  } catch (err) {
    ratingsSummary.innerHTML = `<div class="muted">Could not load ratings summary.</div>`;
    ratingsList.innerHTML = `<div class="muted">Could not load ratings.</div>`;
  }
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.display = "none";

  const qualification_level = document
    .getElementById("qualification_level")
    .value.trim();
  const postcode = document.getElementById("postcode").value.trim();
  const bio = document.getElementById("bio").value.trim();
  const availability_days = document
    .getElementById("availability_days")
    .value.trim();
  const availability_start = document.getElementById("availability_start").value;
  const availability_end = document.getElementById("availability_end").value;

  if (!qualification_level || !postcode) {
    show("error", "qualification_level and postcode are required.");
    return;
  }

  try {
    const data = await api("/api/instructor/profile", {
      method: "POST",
      body: JSON.stringify({
        qualification_level,
        postcode,
        bio: bio || null,
        availability_days: availability_days || null,
        availability_start: availability_start || null,
        availability_end: availability_end || null
      })
    });

    show("ok", data.message || "Profile saved.");
    await loadDbs();
  } catch (err) {
    show("error", err.message);
  }
});

document.getElementById("dbsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.display = "none";

  const dbs_check_type = document.getElementById("dbs_check_type").value;
  const dbs_issued_date = document.getElementById("dbs_issued_date").value;

  //  FIX: checkbox-friendly
  const us = document.getElementById("update_service_member");
  const update_service_member =
    us && us.type === "checkbox" ? us.checked : us?.value === "1";

  const dbs_ref_last4 = document.getElementById("dbs_ref_last4").value.trim();

  if (!dbs_check_type || !dbs_issued_date) {
    show("error", "DBS check type and issued date are required.");
    return;
  }

  if (dbs_ref_last4 && dbs_ref_last4.length !== 4) {
    show("error", "DBS last4 must be exactly 4 digits (or leave empty).");
    return;
  }

  try {
    const data = await api("/api/instructor/dbs/submit", {
      method: "POST",
      body: JSON.stringify({
        dbs_check_type,
        dbs_issued_date,
        update_service_member,
        dbs_ref_last4: dbs_ref_last4 || null
      })
    });

    show("ok", data.message || "DBS submitted.");
    await loadDbs();
  } catch (err) {
    show("error", err.message);
  }
});

async function loadProfile() {
  try {
    const data = await api("/api/instructor/profile", { method: "GET" });
    if (data.profile) {
      const p = data.profile;
      document.getElementById("qualification_level").value = p.qualification_level || "";
      document.getElementById("postcode").value = p.postcode || "";
      document.getElementById("bio").value = p.bio || "";
      document.getElementById("availability_days").value = p.availability_days || "";
      document.getElementById("availability_start").value = p.availability_start
        ? String(p.availability_start).slice(0, 5)
        : "";
      document.getElementById("availability_end").value = p.availability_end
        ? String(p.availability_end).slice(0, 5)
        : "";
    }
  } catch (err) {
    // No profile yet will stay blank 
  }
}

(async () => {
  await guard(["instructor", "admin"]);
  await loadProfile();
  await loadDbs();
  await loadRatings();
})();