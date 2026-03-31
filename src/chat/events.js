/** Render a special event card and auto-dismiss it. */
export function renderEvent(msg) {
  const root = document.getElementById("app");
  if (!root || !msg) return;

  let html = "";
  if (msg.type === "sub" || msg.type === "resub") {
    html = `<div class="ch-event ch-event-sub" data-id="${escHtml(msg.id)}">
      <span class="ch-event-icon">★</span>
      <div class="ch-event-body">
        <span class="ch-event-username">${escHtml(msg.username)}</span>
        <span class="ch-event-text">${escHtml(msg.message)}</span>
      </div>
    </div>`;
  } else if (msg.type === "raid") {
    html = `<div class="ch-event ch-event-raid" data-id="${escHtml(msg.id)}">
      <span class="ch-event-icon">→</span>
      <div class="ch-event-body">
        <span class="ch-event-username">${escHtml(msg.username)}</span>
        <span class="ch-event-text">is raiding with their community</span>
      </div>
    </div>`;
  } else if (msg.type === "superchat" || msg.type === "donation") {
    html = `<div class="ch-event ch-event-donation" data-id="${escHtml(msg.id)}">
      <span class="ch-event-icon">♦</span>
      <div class="ch-event-body">
        <span class="ch-event-username">${escHtml(msg.username)}</span>
        <span class="ch-event-text">${escHtml(msg.message)}</span>
      </div>
    </div>`;
  }

  if (!html) return;

  root.insertAdjacentHTML("afterbegin", html);
  const element = root.querySelector(`.ch-event[data-id="${cssEsc(msg.id)}"]`);
  if (!element) return;

  setTimeout(() => {
    element.classList.add("ch-removing");
    setTimeout(() => {
      element.remove();
    }, 300);
  }, 8000);
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssEsc(str) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(str || ""));
  }
  return String(str || "").replace(/"/g, '\\"');
}
