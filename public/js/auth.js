// Shared API helper (keeps session cookie)
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && data.error
        ? data.error
        : typeof data === "string"
          ? data
          : "Request failed";
    throw new Error(msg);
  }

  return data;
}

// Current session user
async function getMe() {
  return api("/api/auth/me", { method: "GET" });
}

// Logout and go back to login
async function logout() {
  await api("/api/auth/logout", { method: "POST", body: "{}" });
  window.location.href = "/login.html";
}

// Load logged-in user into nav badge
async function loadNavUser() {
  const navUser = document.getElementById("navUser");
  if (!navUser) return;

  try {
    const me = await getMe();
    const user = me.user;

    if (!user) {
      navUser.textContent = "Not logged in";
      return;
    }

    let label = `${user.name} (${user.role})`;

    if (user.role === "instructor") {
      try {
        const summaryData = await api("/api/instructor/ratings/summary", { method: "GET" });
        const avg = summaryData?.summary?.average_rating;

        if (avg !== null && avg !== undefined) {
          label += ` • ★ ${avg}`;
        }
      } catch {
        // Ignore navbar rating errors
      }
    }

    navUser.textContent = label;
  } catch {
    navUser.textContent = "Session error";
  }
}

// Guard pages by role
async function guard(roles = null) {
  const me = await getMe();

  if (!me.user) {
    window.location.href = "/login.html";
    return null;
  }

  await loadNavUser();

  if (roles && !roles.includes(me.user.role)) {
    if (me.user.role === "organisation") {
      window.location.href = "/org-dashboard.html";
    } else {
      window.location.href = "/shifts.html";
    }
    return null;
  }

  return me.user;
}

// Optional navbar load for pages that do not call guard()
loadNavUser();