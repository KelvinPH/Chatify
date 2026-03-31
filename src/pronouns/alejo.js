const API = "https://pronouns.alejo.io/api";

let pronounCache = {};
let pronounList = {};

/** Fetch and cache the Alejo pronoun definitions list. */
export async function fetchPronounList() {
  try {
    const response = await fetch(`${API}/pronouns`);
    if (!response.ok) {
      console.warn("Pronoun list fetch failed.", response.status);
      return {};
    }

    const data = await response.json();
    const out = {};
    for (const item of Array.isArray(data) ? data : []) {
      if (!item?.name) continue;
      out[item.name] = item.subject || "";
    }
    pronounList = out;
    return pronounList;
  } catch (error) {
    console.warn("Pronoun list fetch error.", error);
    return {};
  }
}

/** Fetch and cache a user's pronouns by username/login. */
export async function getPronouns(username) {
  try {
    const key = String(username || "").toLowerCase().trim();
    if (!key) return null;
    if (pronounCache[key] !== undefined) {
      return pronounCache[key];
    }

    const response = await fetch(`${API}/users/${encodeURIComponent(key)}`);
    if (!response.ok) {
      pronounCache[key] = null;
      return null;
    }

    const data = await response.json();
    const first = Array.isArray(data) ? data[0] : null;
    const pronounId = first?.pronoun_id;
    if (!pronounId) {
      pronounCache[key] = null;
      return null;
    }

    const subject = pronounList[pronounId] || null;
    pronounCache[key] = subject;
    return subject;
  } catch (_error) {
    const key = String(username || "").toLowerCase().trim();
    if (key) pronounCache[key] = null;
    return null;
  }
}

/** Clear all cached per-user pronoun lookup values. */
export function clearCache() {
  pronounCache = {};
}
