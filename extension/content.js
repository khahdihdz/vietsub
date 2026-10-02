(() => {
  if (window.__AI_VIETSUB_LOADED__) return;
  window.__AI_VIETSUB_LOADED__ = true;

  let root, shadow, subtitleEl, statusEl, activeVideo;
  let enabled = false;
  let cues = [];

  const ensureUI = () => {
    if (root) return;
    root = document.createElement("div");
    root.id = "ai-vietsub-root";
    root.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    shadow = root.attachShadow({mode:"open"});
    const style = document.createElement("style");
    style.textContent = `
      :host{all:initial}
      .sub{position:fixed;left:50%;bottom:8%;transform:translateX(-50%);max-width:82vw;
        color:#fff;background:rgba(0,0,0,.72);padding:8px 16px;border-radius:8px;
        font:600 22px/1.35 Arial,sans-serif;text-align:center;text-shadow:0 2px 3px #000;
        white-space:pre-wrap;display:none}
      .status{position:fixed;right:16px;top:16px;background:rgba(0,0,0,.75);color:#fff;
        padding:7px 10px;border-radius:6px;font:13px Arial;display:none}
      @media(max-width:600px){.sub{font-size:17px;max-width:90vw}}
    `;
    shadow.append(style);
    subtitleEl = document.createElement("div"); subtitleEl.className="sub";
    statusEl = document.createElement("div"); statusEl.className="status";
    shadow.append(subtitleEl,statusEl);
    document.documentElement.append(root);
  };

  const findVideo = () => {
    const videos = [...document.querySelectorAll("video")];
    if (!videos.length) return null;
    return videos.sort((a,b)=>(b.offsetWidth*b.offsetHeight)-(a.offsetWidth*a.offsetHeight))[0];
  };

  const render = () => {
    if (!enabled || !activeVideo) return;
    const t = activeVideo.currentTime;
    const cue = cues.find(c => t >= c.start && t <= c.end);
    subtitleEl.textContent = cue?.translated || "";
    subtitleEl.style.display = cue ? "block" : "none";
  };

  const attach = () => {
    const v = findVideo();
    if (v === activeVideo) return;
    activeVideo = v;
    if (v) {
      ["timeupdate","seeked","play","pause","ratechange"].forEach(e => v.addEventListener(e, render));
    }
  };

  const scan = () => { ensureUI(); attach(); render(); };
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(scan,1500);
  scan();

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "SET_ENABLED") { enabled=!!msg.enabled; render(); sendResponse({ok:true}); }
    if (msg?.type === "SET_CUES") { cues=Array.isArray(msg.cues)?msg.cues:[]; enabled=true; render(); sendResponse({ok:true}); }
    if (msg?.type === "CLEAR_CUES") { cues=[]; subtitleEl.style.display="none"; sendResponse({ok:true}); }
    return true;
  });
})();