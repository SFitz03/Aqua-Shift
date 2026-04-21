(function () {
  const navActions = document.querySelector(".nav-actions");
  if (!navActions) return;
 
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative;display:inline-block;";
  wrapper.innerHTML = `
    <button id="notifBell" title="Notifications" style="
      background:none;border:none;cursor:pointer;font-size:1.3rem;
      position:relative;padding:4px 6px;line-height:1;vertical-align:middle;
    ">🔔<span id="notifBadge" style="
      display:none;position:absolute;top:0;right:0;
      background:#ff5a6a;color:#fff;border-radius:50%;
      font-size:.6rem;min-width:16px;height:16px;line-height:16px;
      text-align:center;padding:0 3px;font-weight:700;
    "></span></button>
    <div id="notifPanel" style="
      display:none;position:absolute;right:0;top:calc(100% + 6px);
      width:340px;max-height:420px;overflow-y:auto;
      background:#121b2e;border:1px solid rgba(0,201,200,0.12);border-radius:12px;
      box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:999;
    ">
      <div style="padding:10px 14px;border-bottom:1px solid rgba(0,201,200,0.12);display:flex;justify-content:space-between;align-items:center;">
        <strong style="font-size:.95rem;color:#e8eefc;">Notifications</strong>
        <button id="notifMarkRead" style="background:none;border:none;cursor:pointer;color:#00c9c8;font-size:.82rem;">Mark all read</button>
      </div>
      <div id="notifList" style="padding:8px 0;"></div>
    </div>
  `;
 
  navActions.insertBefore(wrapper, navActions.firstChild);
 
  const bell = document.getElementById("notifBell");
  const badge = document.getElementById("notifBadge");
  const panel = document.getElementById("notifPanel");
  const list = document.getElementById("notifList");
  const markReadBtn = document.getElementById("notifMarkRead");
 
  let notifications = [];
  let panelOpen = false;
  let lastCount = 0;
 
  function updateBadge() {
    const unread = notifications.filter((n) => !n.is_read).length;
    if (unread > 0) {
      badge.style.display = "inline-block";
      badge.textContent = unread > 9 ? "9+" : unread;
    } else {
      badge.style.display = "none";
    }
  }
 
  function typeColour(type) {
    return { warning: "#ff5a6a", info: "#00c9c8", success: "#35d07f" }[type] || "#a7b3d3";
  }
 
  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
 
  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
 
  function renderList() {
    if (notifications.length === 0) {
      list.innerHTML = `<div style="padding:14px;color:#a7b3d3;text-align:center;font-size:.9rem;">No notifications yet</div>`;
      return;
    }
    list.innerHTML = notifications.map((n) => `
      <div style="
        padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.06);
        background:${n.is_read ? "transparent" : "rgba(0,201,200,0.06)"};
      ">
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="color:${typeColour(n.type)};font-size:1rem;margin-top:2px;">●</span>
          <div style="flex:1;">
            <div style="font-size:.88rem;line-height:1.4;color:#e8eefc;">${escapeHtml(n.message)}</div>
            <div style="font-size:.75rem;color:#a7b3d3;margin-top:3px;">${timeAgo(n.created_at)}</div>
          </div>
        </div>
      </div>`
    ).join("");
  }
 
  function flashBell() {
    bell.style.transform = "scale(1.3)";
    setTimeout(() => (bell.style.transform = "scale(1)"), 300);
  }
 
  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const fresh = data.notifications || [];
 
      const newUnread = fresh.filter((n) => !n.is_read).length;
      if (newUnread > lastCount) flashBell();
      lastCount = newUnread;
 
      notifications = fresh;
      updateBadge();
      if (panelOpen) renderList();
    } catch {
      // silently fail — not critical
    }
  }
 
  markReadBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });
      notifications = notifications.map((n) => ({ ...n, is_read: true }));
      lastCount = 0;
      updateBadge();
      renderList();
    } catch {}
  });
 
  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    panelOpen = !panelOpen;
    panel.style.display = panelOpen ? "block" : "none";
    if (panelOpen) renderList();
  });
 
  document.addEventListener("click", () => {
    panelOpen = false;
    panel.style.display = "none";
  });
 
  panel.addEventListener("click", (e) => e.stopPropagation());
 
  // Initial load then poll every 15 seconds
  fetchNotifications();
  setInterval(fetchNotifications, 15000);
 
})();
 