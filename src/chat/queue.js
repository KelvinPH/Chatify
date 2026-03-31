const DEFAULT_MAX = 50;

let messages = [];
let maxMessages = DEFAULT_MAX;
let onUpdateCallback = null;

/** Initialize message queue settings and update callback. */
export function init(options = {}) {
  const nextMax = Number(options.max);
  maxMessages = Number.isFinite(nextMax) && nextMax > 0 ? nextMax : DEFAULT_MAX;
  onUpdateCallback = typeof options.onUpdate === "function" ? options.onUpdate : null;
}

/** Add a message, enforce queue cap, and notify listeners. */
export function add(message) {
  messages.push(message);
  if (messages.length > maxMessages) {
    messages = messages.slice(messages.length - maxMessages);
  }
  notify();
}

/** Remove one message by its message ID and notify listeners. */
export function remove(messageId) {
  messages = messages.filter((msg) => String(msg?.id) !== String(messageId));
  notify();
}

/** Remove all messages for a username and notify listeners. */
export function removeByUsername(username) {
  const target = String(username || "").toLowerCase();
  messages = messages.filter((msg) => String(msg?.username || "").toLowerCase() !== target);
  notify();
}

/** Clear all queued messages and notify listeners. */
export function clear() {
  messages = [];
  notify();
}

/** Return a shallow copy of all queued messages. */
export function getAll() {
  return [...messages];
}

/** Set queue max size, trim oldest entries, and notify listeners. */
export function setMax(n) {
  const nextMax = Number(n);
  if (!Number.isFinite(nextMax) || nextMax <= 0) return;
  maxMessages = nextMax;
  if (messages.length > maxMessages) {
    messages = messages.slice(messages.length - maxMessages);
  }
  notify();
}

function notify() {
  if (onUpdateCallback) {
    onUpdateCallback([...messages]);
  }
}
