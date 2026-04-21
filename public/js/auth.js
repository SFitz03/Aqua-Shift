// Shared API helper with 8 second timeout
async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
 
  try {
    const res = await fetch(path, {
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
 
    clearTimeout(timer);
 
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
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    throw err;
  }
}
 
// Current session user
async function getMe() {
  return api("/api/auth/me", { method: "GET" });
}
 
// Logout and go back to login
async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
  } catch {}
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
 
    navUser.textContent = `${user.name} (${user.role})`;
 
    // Load rating in background for instructors — don't block nav render
    if (user.role === "instructor") {
      api("/api/instructor/ratings/summary", { method: "GET" })
        .then((summaryData) => {
          const avg = summaryData?.summary?.average_rating;
          if (avg !== null && avg !== undefined) {
            navUser.textContent = `${user.name} (${user.role}) • ★ ${avg}`;
          }
        })
        .catch(() => {});
    }
  } catch {
    navUser.textContent = "Session error";
  }
}
 
// Guard pages by role
async function guard(roles = null) {
  try {
    const me = await getMe();
 
    if (!me.user) {
      window.location.href = "/login.html";
      return null;
    }
 
    loadNavUser();
 
    if (roles && !roles.includes(me.user.role)) {
      if (me.user.role === "organisation") {
        window.location.href = "/org-dashboard.html";
      } else {
        window.location.href = "/shifts.html";
      }
      return null;
    }
 
    return me.user;
  } catch (err) {
    window.location.href = "/login.html";
    return null;
  }
}