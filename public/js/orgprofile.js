const msg = document.getElementById("msg");
const form = document.getElementById("orgProfileForm");

document.getElementById("logoutBtn").addEventListener("click", logout);

function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.display = "none";

  const organisation_name = document.getElementById("organisation_name").value.trim();
  const postcode = document.getElementById("postcode").value.trim();
  const contact_phone = document.getElementById("contact_phone").value.trim();

  if (!organisation_name || !postcode || !contact_phone) {
    show("error", "Please complete all fields.");
    return;
  }

  try {
    await api("/api/org/profile", {
      method: "POST",
      body: JSON.stringify({ organisation_name, postcode, contact_phone })
    });

    show("ok", "Organisation profile saved.");
  } catch (err) {
    show("error", err.message);
  }
});

(async () => {
  await guard(["organisation", "admin"]);
})();