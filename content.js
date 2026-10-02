(() => {
  if (window.__AI_VIETSUB__) return;
  window.__AI_VIETSUB__ = 1;

  let video = null, cues = [], enabled = true, dubbing = false, voice = null, last = -1, style = {};
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

  function render() {
    if (!video || !enabled) return;
    const t = video.currentTime;
    const c = cues.find(x => t >= x.start && t <= x.end);
    el.textContent = c?.translated || c?.text || "";
    el.classList.toggle("off", !c);
    if (c && dubbing && c.id !== last) {
      last = c.id;
      speak(c.translated || c.text);
    }
  }

  function speak(text) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "vi-VN";
    u.rate = Number(style.rate || 1);
    u.volume = Number(style.volume || 1);
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  function attach() {
    const v = find();
    if (v === video) return;
    if (video) ["timeupdate", "seeked", "play", "pause"].forEach(e => video.removeEventListener(e, render));
    video = v;
    if (v) ["timeupdate", "seeked", "play", "pause"].forEach(e => v.addEventListener(e, render));
  }

  setInterval(() => { attach(); render(); }, 250);

  chrome.runtime.onMessage.addListener((m, s, send) => {
    if (m.type === "SET_CUES") {
      cues = m.cues || [];
      enabled = true;
      last = -1;
      render();
      send({ ok: true });
    }
    if (m.type === "SET_ENABLED") {
      enabled = !!m.enabled;
      if (!enabled) speechSynthesis.cancel();
      render();
      send({ ok: true });
    }
    if (m.type === "SET_DUBBING") {
      dubbing = !!m.enabled;
      style = m.style || {};
      if (!dubbing) speechSynthesis.cancel();
      send({ ok: true });
    }
    if (m.type === "CLEAR") {
      cues = [];
      speechSynthesis.cancel();
      el.classList.add("off");
      send({ ok: true });
    }
    return true;
  });
})();