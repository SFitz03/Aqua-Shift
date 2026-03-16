const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");

function show(type, text) {
  if (!msg) return;
  msg.className = `notice ${type || ""}`;
  msg.textContent = text;
  msg.style.display = "block";
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.style.display = "none";

    const email = document.getElementById("email")?.value.trim() || "";
    const password = document.getElementById("password")?.value || "";

    if (!email || !password) {
      show("error", "Email and password are required.");
      return;
    }

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      show("ok", "Login successful.");

      if (data.user.role === "organisation") {
        window.location.href = "/org-dashboard.html";
      } else if (data.user.role === "instructor") {
        window.location.href = "/instructor-dashboard.html";
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      show("error", err.message);
    }
  });
}