const msg = document.getElementById("msg");
const list = document.getElementById("list");
const filter = document.getElementById("filter");

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", load);

// ✅ NEW: actually apply the filter without needing refresh
if (filter) filter.addEventListener("change", load);

function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}

function safe(v) {
  return (v === null || v === undefined) ? "" : String(v);
}

// ✅ FIXED: more robust status normalisation
function labelStatus(ip) {
  const s = (ip.dbs_status || "").toLowerCase();
  if (s) return s;

  const checked =
    ip.dbs_checked === 1 ||
    ip.dbs_checked === true ||
    ip.dbs_checked === "1";

  return checked ? "verified" : "not_submitted";
}

function row(ip) {
  const status = labelStatus(ip);

  const isPending = status === "pending";
  const canVerify = isPending;
  const canReject = isPending;

  return `
    <div class="item">
      <div class="item-main">
        <div class="item-title">
          ${safe(ip.instructor_name)} <span class="badge">${status}</span>
        </div>

        <div class="item-sub muted">
          ${safe(ip.instructor_email)} • ${safe(ip.qualification_level || "—")} • Postcode: ${safe(ip.instructor_postcode || "—")}
        </div>

        <div class="item-sub muted">
          Type: ${safe(ip.dbs_check_type || "—")}
          • Issued: ${safe(ip.dbs_issued_date || "—").slice(0,10)}
          • Update service: ${ip.update_service_member ? "yes" : "no"}
          • Ref(last4): ${safe(ip.dbs_ref_last4 || "—")}
        </div>
      </div>

      <div class="item-actions">
        ${canVerify ? `<button class="btn primary" data-verify="${ip.instructor_profile_id}">Verify</button>` : ``}
        ${canReject ? `<button class="btn danger" data-reject="${ip.instructor_profile_id}">Reject</button>` : ``}
      </div>
    </div>
  `;
}

async function load() {
  msg.style.display = "none";
  list.innerHTML = `<div class="muted">Loading…</div>`;

  try {
    const data = await api("/api/org/bookings", { method: "GET" });
    const bookings = data.bookings || [];

    // Deduplicate by instructor_profile_id
    const map = new Map();
    for (const b of bookings) {
      const id = b.instructor_profile_id;
      if (!id) continue;

      if (!map.has(id)) {
        map.set(id, {
          instructor_profile_id: id,
          instructor_name: b.instructor_name,
          instructor_email: b.instructor_email,
          qualification_level: b.qualification_level,
          instructor_postcode: b.instructor_postcode,
          dbs_checked: b.dbs_checked,
          dbs_status: b.dbs_status,
          dbs_check_type: b.dbs_check_type,
          dbs_issued_date: b.dbs_issued_date,
          update_service_member: b.update_service_member,
          dbs_ref_last4: b.dbs_ref_last4
        });
      }
    }

    let instructors = Array.from(map.values());

    // ✅ NEW: filter handling
    if (filter && filter.value === "pending") {
      instructors = instructors.filter((x) => labelStatus(x) === "pending");
    }

    // ✅ NEW: nicer ordering (pending first)
    instructors.sort((a, b) => {
      const order = { pending: 0, rejected: 1, not_submitted: 2, verified: 3 };
      const sa = labelStatus(a);
      const sb = labelStatus(b);
      const oa = order[sa] ?? 99;
      const ob = order[sb] ?? 99;
      if (oa !== ob) return oa - ob;
      return safe(a.instructor_name).localeCompare(safe(b.instructor_name));
    });

    if (!instructors.length) {
      list.innerHTML = `<div class="muted">No instructors to show for this filter.</div>`;
      return;
    }

    list.innerHTML = instructors.map(row).join("");

    list.querySelectorAll("[data-verify]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-verify");

        const notes =
          prompt("Optional notes (visible to admin only). Leave blank if none:") || "";

        try {
          await api(`/api/org/instructors/${id}/dbs/verify`, {
            method: "POST",
            body: JSON.stringify({ dbs_notes: notes })
          });
          show("ok", "Instructor DBS marked as verified.");
          await load();
        } catch (err) {
          show("error", err.message);
        }
      });
    });

    list.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-reject");

        const notes =
          prompt("Reason/notes for rejection (recommended):") || "";

        if (!notes) {
          alert("Please add a short reason so the decision is auditable.");
          return;
        }

        try {
          await api(`/api/org/instructors/${id}/dbs/reject`, {
            method: "POST",
            body: JSON.stringify({ dbs_notes: notes })
          });
          show("ok", "Instructor DBS marked as rejected.");
          await load();
        } catch (err) {
          show("error", err.message);
        }
      });
    });

  } catch (err) {
    list.innerHTML = "";
    show("error", err.message);
  }
}

(async () => {
  await guard(["organisation", "admin"]);
  await load();
})();