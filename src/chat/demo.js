import { badgesToHtml } from "../badges/renderer.js";

/** Build a realistic set of fake messages for demo/config preview. */
export function buildDemoMessages() {
  const rows = [
    { username: "StreamerFan99", message: "lets gooo PogChamp", color: "#FF6B6B" },
    { username: "xXgamerXx", message: "this overlay looks clean af", color: "#4ECDC4" },
    { username: "chill_vibes", message: "mood sync is insane", color: "#45B7D1" },
    { username: "TwitchUser_1", message: "W stream today", color: "#96CEB4" },
    {
      username: "moderator_sam",
      message: "reminder to follow!",
      color: "#FFEAA7",
      isMod: true
    },
    {
      username: "sub_hype",
      message: "just subbed, love the content",
      color: "#DDA0DD",
      isSubscriber: true
    },
    { username: "lurker_mode", message: "been watching for hours lol", color: "#98D8C8" },
    {
      username: "vip_user",
      message: "that beat sync is insane",
      color: "#F7DC6F",
      isVip: true
    },
    {
      username: "newchatter",
      message: "first time here, great stream!",
      color: "#BB8FCE",
      isFirstMessage: true
    },
    { username: "hype_train", message: "HYPE HYPE HYPE", color: "#FF8C69" },
    { username: "question_guy", message: "what overlay is this?", color: "#87CEEB" },
    { username: "regular_viewer", message: "classic banger", color: "#F0A500" }
  ];

  return rows.map((row, idx) => {
    const badges = [];
    if (row.isMod) badges.push({ id: "moderator", version: "1", url: "" });
    if (row.isVip) badges.push({ id: "vip", version: "1", url: "" });
    if (row.isSubscriber) badges.push({ id: "subscriber", version: "1", url: "" });

    return {
      id: `demo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      platform: "twitch",
      username: row.username,
      usernameColor: row.color,
      message: row.message,
      emotes: {},
      badges,
      isSubscriber: Boolean(row.isSubscriber),
      isMod: Boolean(row.isMod),
      isVip: Boolean(row.isVip),
      isBroadcaster: false,
      isFirstMessage: Boolean(row.isFirstMessage),
      bits: 0,
      timestamp: Date.now(),
      type: "message",
      renderedBadges: badgesToHtml(badges, {}),
      renderedMessage: escHtml(row.message),
      pronouns: null
    };
  });
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
