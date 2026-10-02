chrome.runtime.onMessage.addListener((m, s, send) => {
  if (m?.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    send({ ok: true });
    return true;
  }

  if (m?.type === "TRANSLATE") {
    chrome.storage.local.get(["apiKey", "model", "prompt", "temperature"]).then(async c => {
      try {
        if (!c.apiKey) throw new Error("Chưa cấu hình OpenRouter API key.");
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
              { role: "user", content: JSON.stringify(m.cues || []) }
            ]
          })
        });
        if (!r.ok) throw new Error("OpenRouter HTTP " + r.status);
        const d = await r.json();
        let t = d?.choices?.[0]?.message?.content || "";
        t = t.replace(/^\s*\`\`\`(?:json)?\s*/, "").replace(/\s*\`\`\`\s*$/, "").trim();
        const a = JSON.parse(t);
        if (!Array.isArray(a)) throw new Error("OpenRouter trả về dữ liệu không hợp lệ.");
        send({ ok: true, result: a });
      } catch (e) {
        send({ ok: false, error: e.message });
      }
    });
    return true;
  }
});