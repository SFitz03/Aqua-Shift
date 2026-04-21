const msg = document.getElementById("msg");
const form = document.getElementById("orgForm");

document.getElementById("logoutBtn").addEventListener("click", logout);

// Prefill demo data
const prefillBtn = document.getElementById("prefillBtn");
if (prefillBtn) {
  prefillBtn.addEventListener("click", () => {
    document.getElementById("organisation_name").value = "Bristol Aquatics Club";
    document.getElementById("postcode").value = "BS16 1QY";
    document.getElementById("contact_phone").value = "07700 900123";
  });
}

function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}

async function loadProfile() {
  try {
    const data = await api("/api/org/profile", { method: "GET" });
    if (data.profile) {
      document.getElementById("organisation_name").value = data.profile.organisation_name || "";
      document.getElementById("postcode").value = data.profile.postcode || "";
      document.getElementById("contact_phone").value = data.profile.contact_phone || "";
    }
  } catch (err) {
    // No profile yet — form stays blank, that's fine
  }
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
  await loadProfile();
})();