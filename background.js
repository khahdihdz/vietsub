let captureTabId = null;
let captureRunning = false;
const autoCues = new Map();

chrome.runtime.onMessage.addListener((m, s, send) => {
  if (m?.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    send({ ok: true });
    return true;
  }

  if (m?.type === "TRANSLATE") {
    translateCues(m.cues || []).then(r => send(r));
    return true;
  }

  if (m?.type === "GET_AUTO_STATUS") {
    send({ ok: true, running: captureRunning, count: autoCues.get(m.tabId)?.length || 0 });
    return true;
  }

  if (m?.type === "START_AUTO_SUBTITLE") {
    startAutoSubtitle(m.tabId).then(r => send(r));
    return true;
  }

  if (m?.type === "STOP_AUTO_SUBTITLE") {
    stopAutoSubtitle().then(r => send(r));
    return true;
  }

  if (m?.type === "AUTO_SUBTITLE_CHUNK") {
    handleAudioChunk(m).then(r => send(r));
    return true;
  }
});

async function getSettings() {
  return chrome.storage.local.get(["apiKey", "model", "sttModel", "prompt", "temperature", "autoTranslate"]);
}

async function translateCues(cues) {
  try {
    const c = await getSettings();
    if (!c.apiKey) throw new Error("Chưa cấu hình OpenRouter API key.");
    if (!cues.length) return { ok: true, result: [] };
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + c.apiKey,
        "Content-Type": "application/json",
        "X-Title": "AI Vietsub & Dubbing"
      },
      body: JSON.stringify({
        model: c.model || "google/gemini-2.5-flash",
        temperature: Number(c.temperature ?? 0.2),
        messages: [
          {
            role: "system",
            content: (c.prompt || "Translate naturally into Vietnamese with context. Preserve names, placeholders, tone and character relationships.") +
              " Return ONLY valid JSON array [{id,translation}]."
          },
          { role: "user", content: JSON.stringify(cues) }
        ]
      })
    });
    if (!r.ok) throw new Error("OpenRouter HTTP " + r.status);
    const d = await r.json();
    let t = d?.choices?.[0]?.message?.content || "";
    t = t.replace(/^\s*\`\`\`(?:json)?\s*/, "").replace(/\s*\`\`\`\s*$/, "").trim();
    const a = JSON.parse(t);
    if (!Array.isArray(a)) throw new Error("OpenRouter trả về dữ liệu không hợp lệ.");
    return { ok: true, result: a };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Capture audio from the active tab for automatic subtitle transcription."
  });
}

async function startAutoSubtitle(tabId) {
  try {
    if (!tabId) throw new Error("Không xác định được tab hiện tại.");
    const c = await getSettings();
    if (!c.apiKey) throw new Error("Hãy nhập OpenRouter API key trước.");
    if (captureRunning) await stopAutoSubtitle();

    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    await ensureOffscreen();

    captureTabId = tabId;
    captureRunning = true;
    autoCues.set(tabId, []);

    const start = await chrome.tabs.sendMessage(tabId, { type: "GET_VIDEO_TIME" }).catch(() => ({ time: 0 }));
    await chrome.runtime.sendMessage({
      type: "OFFSCREEN_START_CAPTURE",
      streamId,
      tabId,
      startTime: Number(start?.time || 0)
    });

    return { ok: true };
  } catch (e) {
    captureRunning = false;
    captureTabId = null;
    return { ok: false, error: e.message };
  }
}

async function stopAutoSubtitle() {
  captureRunning = false;
  captureTabId = null;
  try {
    await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP_CAPTURE" });
  } catch {}
  try { await chrome.offscreen.closeDocument(); } catch {}
  return { ok: true };
}

async function handleAudioChunk(m) {
  if (!captureRunning || m.tabId !== captureTabId) return { ok: false, error: "Capture đã dừng." };
  try {
    const c = await getSettings();
    if (!c.apiKey) throw new Error("Thiếu OpenRouter API key.");
    const body = {
      model: c.sttModel || "openai/whisper-large-v3-turbo",
      input_audio: { data: m.data, format: m.format || "webm" },
      language: m.language || undefined,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"]
    };
    const r = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + c.apiKey,
        "Content-Type": "application/json",
        "X-Title": "AI Vietsub & Dubbing"
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error("STT HTTP " + r.status + (txt ? ": " + txt.slice(0, 180) : ""));
    }
    const d = await r.json();
    const segments = Array.isArray(d.segments) && d.segments.length
      ? d.segments
      : (d.text ? [{ start: 0, end: Number(m.duration || 8), text: d.text }] : []);
    const base = Number(m.startTime || 0);
    let raw = segments.map((x, i) => ({
      id: "auto-" + m.chunkId + "-" + i,
      start: base + Number(x.start || 0),
      end: base + Number(x.end || Math.max(Number(x.start || 0) + 1, Number(m.duration || 8))),
      text: String(x.text || "").trim()
    })).filter(x => x.text);

    if (!raw.length) return { ok: true, count: 0 };

    const translated = c.autoTranslate === false ? raw : (await translateCues(raw));
    if (!translated.ok) throw new Error(translated.error);
    const map = new Map((translated.result || []).map(x => [String(x.id), x.translation]));
    const result = raw.map(x => ({ ...x, translated: map.get(String(x.id)) || x.text }));
    const list = autoCues.get(m.tabId) || [];
    list.push(...result);
    list.sort((a, b) => a.start - b.start);
    autoCues.set(m.tabId, list);

    await chrome.tabs.sendMessage(m.tabId, { type: "APPEND_CUES", cues: result }).catch(() => {});
    return { ok: true, count: result.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}