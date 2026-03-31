# Chatify

**The free glassmorphism chat overlay for OBS — Twitch, YouTube, and Kick**

No server required. No Streamlabs. No extra software. Just a URL in OBS.

---

## What is Chatify?

Chatify shows your live chat as a beautiful glassmorphism overlay
in OBS, Streamlabs, or StreamElements. It connects directly to
Twitch IRC, YouTube Live, or Kick via WebSocket — no login needed
for basic chat display.

It is free, open source, and designed to actually look good.

---

## Features

- Twitch, YouTube, and Kick support out of the box
- Glassmorphism design — real backdrop blur, not just dark boxes
- Full emote support — Twitch, BTTV, FFZ, and 7TV
- Badge rendering — mod, VIP, sub, broadcaster
- Pronoun display via pronouns.alejo.io
- Sub, raid, and donation event cards
- Message delete and timeout animations
- First message highlighting
- 6 themes — Obsidian, Midnight, Aurora, Forest, Amber, Glass
- 3 layouts — Floating, Sidebar, Ticker
- Visual Configurator with live preview
- All settings save to localStorage — never re-enter anything
- Demo mode — see fake messages in preview without a live stream

---

## Quick start (2 minutes)

### Twitch
1. Open the [Configurator](https://kelvinph.github.io/Chatify/config.html)
2. Select Twitch and enter your channel name
3. Pick a theme and layout
4. Click **Copy URL**
5. In OBS: Sources → + → Browser Source → paste URL
6. Recommended size: **400 × 600 px**

### YouTube
1. Get a free API key at [console.cloud.google.com](https://console.cloud.google.com)
   → Enable YouTube Data API v3 → Create credentials → API key
2. Open the Configurator, select YouTube
3. Enter your Channel ID and API key
4. Copy URL → paste into OBS Browser Source

### Kick
1. Open the Configurator, select Kick
2. Enter your channel name
3. Copy URL → paste into OBS Browser Source

---

## Links

- [Configurator](https://kelvinph.github.io/Chatify/config.html)
- [Overlay URL](https://kelvinph.github.io/Chatify/overlay.html)
- [GitHub](https://github.com/KelvinPH/Chatify)

---

## Emote support

| Provider | Global | Channel |
|----------|--------|---------|
| Twitch   | yes    | yes     |
| BTTV     | yes    | yes     |
| FFZ      | no     | yes     |
| 7TV      | yes    | yes     |

---

## URL parameters

All settings are controlled via URL parameters generated
by the Configurator. Key parameters:

| Param            | Values                          | Default    |
|------------------|---------------------------------|------------|
| `platform`       | `twitch` / `youtube` / `kick`   | `twitch`   |
| `channel`        | channel name                    | —          |
| `theme`          | `obsidian` / `midnight` / `aurora` / `forest` / `amber` / `glass` | `obsidian` |
| `layout`         | `floating` / `sidebar` / `ticker` | `floating` |
| `maxMessages`    | number                          | `50`       |
| `showBadges`     | `1` / `0`                       | `1`        |
| `showPronouns`   | `1` / `0`                       | `0`        |
| `transparent`    | `1` / `0`                       | `0`        |
| `fontSize`       | number (px)                     | `14`       |
| `animateIn`      | `slide` / `fade` / `pop`        | `slide`    |
| `demo`           | `1` / `0`                       | `0`        |

---

## OBS recommended sizes

| Layout   | Width | Height |
|----------|-------|--------|
| Floating | 400   | 600    |
| Sidebar  | 340   | 900    |
| Ticker   | 900   | 80     |

---

## Themes

| Theme    | Background | Accent  |
|----------|------------|---------|
| Obsidian | Pure black | White   |
| Midnight | Deep navy  | Blue    |
| Aurora   | Deep purple| Purple  |
| Forest   | Dark teal  | Green   |
| Amber    | Warm dark  | Gold    |
| Glass    | Frosted    | White   |

---

## Privacy

- No server required for Twitch and Kick
- YouTube requires a free Google API key (your key, your quota)
- No data is collected or transmitted to any Chatify server
- Twitch IRC connection is anonymous read-only
- All settings stored locally in your browser

---

## Deploying your own copy

1. Fork this repository
2. Go to Settings → Pages → Deploy from branch → main → / (root)
3. Your configurator: `https://{username}.github.io/Chatify/config.html`

---

## Known limitations

- Twitch badge images require an authenticated Twitch token
  (optional — fallback text badges are shown without it)
- YouTube chat requires polling every 2.5 seconds due to
  no WebSocket API — there may be slight delay
- Kick channel lookup may require the CORS proxy on some browsers
- Pronouns depend on users having registered at pronouns.alejo.io

---

## Built with

- Vanilla JS, ES modules, no build step
- BTTV API, FFZ API, 7TV API
- Alejo.io Pronouns API
- Twitch IRC WebSocket
- Kick Pusher WebSocket
- YouTube Data API v3

---

## Related

- [Nowify](https://github.com/KelvinPH/Nowify) — Spotify now playing
  overlay for OBS, built by the same developer

---

Made with care for streamers who want their stream to look good.
