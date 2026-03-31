/** Build a combined word-based emote map for BTTV, FFZ, and 7TV. */
export function buildEmoteMap(bttvEmotes, ffzEmotes, seventvEmotes) {
  const bttv = withProvider(bttvEmotes || {}, "bttv");
  const ffz = withProvider(ffzEmotes || {}, "ffz");
  const seventv = withProvider(seventvEmotes || {}, "7tv");
  return { ...bttv, ...ffz, ...seventv };
}

/** Parse a chat message into text/emote tokens using a word emote map. */
export function parseMessage(message, emoteMap) {
  const text = String(message || "");
  const words = text.split(" ");
  const tokens = [];
  let textBuffer = "";

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const emote = emoteMap?.[word];

    if (emote) {
      if (textBuffer) {
        tokens.push({ type: "text", content: textBuffer });
        textBuffer = "";
      }
      tokens.push({
        type: "emote",
        name: word,
        url: emote.url || "",
        provider: emote.provider || "bttv"
      });
    } else {
      textBuffer = textBuffer ? `${textBuffer} ${word}` : word;
    }
  }

  if (textBuffer) {
    tokens.push({ type: "text", content: textBuffer });
  }

  return tokens;
}

/** Render text/emote tokens into safe HTML for the chat renderer. */
export function tokensToHtml(tokens) {
  return (Array.isArray(tokens) ? tokens : [])
    .map((token) => {
      if (token?.type === "text") {
        return escHtml(token.content || "");
      }
      if (token?.type === "emote") {
        const url = token.url || "";
        const name = token.name || "";
        return `<img class="ch-emote" src="${url}" alt="${escHtml(name)}" title="${escHtml(name)}" loading="lazy" />`;
      }
      return "";
    })
    .join("");
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function withProvider(map, provider) {
  const out = {};
  for (const [name, value] of Object.entries(map)) {
    out[name] = { ...(value || {}), provider };
  }
  return out;
}
