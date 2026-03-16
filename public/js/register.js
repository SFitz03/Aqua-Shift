const form = document.getElementById("registerForm");
const msg = document.getElementById("msg");

function show(type, text) {
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}

function selectedRole() {
  const el = document.querySelector("input[name='role']:checked");
  return el ? el.value : null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.display = "none";

  const role = selectedRole();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;

  if (!role || !name || !email || !password) {
    show("error", "Please complete all fields.");
    return;
  }

  if (password.length < 8) {
    show("error", "Password must be at least 8 characters.");
    return;
  }

  if (password !== confirm) {
    show("error", "Passwords do not match.");
    return;
  }

  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role })
    });

    show("ok", "Registered. Redirecting…");

    setTimeout(() => {
      window.location.href = "/";
    }, 400);

  } catch (err) {
    show("error", err.message);
  }
});