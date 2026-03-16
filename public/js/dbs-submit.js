const form = document.getElementById("dbsForm");
const msg = document.getElementById("msg");

function setMsg(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle("error", isError);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const data = Object.fromEntries(new FormData(form).entries());
  const dbs_reference = (data.dbs_reference || "").trim();

  if (!dbs_reference) return setMsg("Enter your DBS reference number.", true);

  try {
    const res = await fetch("/api/instructor/dbs/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dbs_reference })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(body.error || "Failed to submit DBS.", true);

    setMsg("Submitted. Your DBS status is now pending.");
    setTimeout(() => (window.location.href = "/dashboard.html"), 700);
  } catch (err) {
    console.error(err);
    setMsg("Network error. Try again.", true);
  }
});