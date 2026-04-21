const form = document.getElementById("dbsForm");
const msg = document.getElementById("msg");
const submitBtn = form.querySelector("button[type=submit]");
 
function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}
 
document.getElementById("logoutBtn").addEventListener("click", logout);
 
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.display = "none";
 
  const dbs_check_type = document.getElementById("dbs_check_type").value;
  const dbs_issued_date = document.getElementById("dbs_issued_date").value;
  const update_service_member = document.getElementById("update_service_member").value === "1";
  const dbs_ref_last4 = document.getElementById("dbs_ref_last4").value.trim();
 
  if (!dbs_check_type || !dbs_issued_date) {
    show("error", "DBS check type and issued date are required.");
    return;
  }
 
  if (dbs_ref_last4 && dbs_ref_last4.length !== 4) {
    show("error", "DBS last4 must be exactly 4 digits (or leave empty).");
    return;
  }
 
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";
 
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
 
    show("ok", data.message || "DBS submitted. Your status is now pending.");
    setTimeout(() => (window.location.href = "/instructor-profile.html"), 1200);
  } catch (err) {
    show("error", err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit DBS";
  }
});
 
(async () => {
  await guard(["instructor", "admin"]);
})();