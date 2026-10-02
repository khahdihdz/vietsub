(() => {
  if (window.__AI_VIETSUB__) return;
  window.__AI_VIETSUB__ = 1;

  let video = null, cues = [], enabled = true, dubbing = false, voice = null;
  let lastSpokenId = null, style = {};

  const root = document.createElement("div");
  root.id = "ai-vietsub-root";
  root.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  const sh = root.attachShadow({ mode: "open" });
  const css = document.createElement("style");
  css.textContent = ".sub{position:fixed;left:50%;bottom:8%;transform:translateX(-50%);max-width:84vw;padding:8px 16px;border-radius:8px;background:rgba(0,0,0,.72);color:#fff;font:600 22px/1.35 Arial;text-align:center;white-space:pre-wrap;text-shadow:0 2px 3px #000}.off{display:none!important}";
  sh.append(css);
  const el = document.createElement("div");
  el.className = "sub off";
  sh.append(el);
  document.documentElement.append(root);

  function find() {
    return [...document.querySelectorAll("video")]
      .sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0] || null;
  }

  function activeCue() {
    if (!video) return null;
    const t = video.currentTime;
    return cues.find(x => t >= Number(x.start) && t <= Number(x.end)) || null;
  }

  function render() {
    if (!video || !enabled) return;
    const c = activeCue();
    el.textContent = c?.translated || c?.text || "";
    el.classList.toggle("off", !c);

    // A newly translated live cue can arrive after its start time. Speaking is
    // therefore triggered from render(), not only from a play/timeupdate event.
    if (c && dubbing && c.id !== lastSpokenId) {
      lastSpokenId = c.id;
      speak(c.translated || c.text);
    }
  }

  function speak(text) {
    if (!text || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "vi-VN";
    u.rate = Number(style.rate || 1);
    u.volume = Number(style.volume ?? 1);
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  function loadVoice() {
    if (!("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices();
    voice = voices.find(v => /^vi(-|_)?VN$/i.test(v.lang)) ||
      voices.find(v => /^vi/i.test(v.lang)) || null;
  }
  loadVoice();
  if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = loadVoice;

  function attach() {
    const v = find();
    if (v === video) return;
    if (video) ["timeupdate", "seeked", "play", "pause"].forEach(e => video.removeEventListener(e, render));
    video = v;
    lastSpokenId = null;
    if (v) ["timeupdate", "seeked", "play", "pause"].forEach(e => v.addEventListener(e, render));
  }

  setInterval(() => { attach(); render(); }, 150);

  chrome.runtime.onMessage.addListener((m, s, send) => {
    if (m.type === "GET_VIDEO_TIME") {
      send({ ok: true, time: video?.currentTime || 0 });
      return true;
    }
    if (m.type === "SET_CUES") {
      cues = (m.cues || []).slice().sort((a, b) => a.start - b.start);
      enabled = true;
      lastSpokenId = null;
      render();
      send({ ok: true });
    }
    if (m.type === "APPEND_CUES") {
      const byId = new Map(cues.map(x => [String(x.id), x]));
      for (const c of (m.cues || [])) byId.set(String(c.id), c);
      cues = [...byId.values()].sort((a, b) => Number(a.start) - Number(b.start));
      render();
      send({ ok: true });
    }
    if (m.type === "SET_ENABLED") {
      enabled = !!m.enabled;
      if (!enabled) {
        speechSynthesis.cancel();
        lastSpokenId = null;
      }
      render();
      send({ ok: true });
    }
    if (m.type === "SET_DUBBING") {
      dubbing = !!m.enabled;
      style = m.style || {};
      if (!dubbing) {
        speechSynthesis.cancel();
        lastSpokenId = null;
      } else {
        lastSpokenId = null;
        render();
      }
      send({ ok: true });
    }
    if (m.type === "CLEAR") {
      cues = [];
      speechSynthesis.cancel();
      lastSpokenId = null;
      el.classList.add("off");
      send({ ok: true });
    }
    return true;
  });
})();