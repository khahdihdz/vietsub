export async function translateBatch(cues, config) {
  if (!config.apiKey) throw new Error("Chưa cấu hình OpenRouter API key.");
  const payload = cues.map(c => ({id:c.id,text:c.text}));
  const system = config.prompt || "Translate naturally into Vietnamese with context.";
  const body = {model:config.model||"google/gemini-2.5-flash",temperature:0.2,messages:[
    {role:"system",content:system+" Return ONLY a JSON array like [{\"id\":\"1\",\"translation\":\"...\"}]. Preserve IDs exactly."},
    {role:"user",content:JSON.stringify(payload)}
  ]};
  const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+config.apiKey,"Content-Type":"application/json","X-Title":"AI Vietsub & Dubbing"},body:JSON.stringify(body)});
  if(!res.ok) throw new Error("OpenRouter HTTP "+res.status);
  const data=await res.json(), text=data?.choices?.[0]?.message?.content||"";
  const clean=text.replace(/^\s*\`\`\`json\s*/,"").replace(/\s*\`\`\`\s*$/,"").trim();
  const parsed=JSON.parse(clean), map=new Map(parsed.map(x=>[String(x.id),String(x.translation||"")]));
  return cues.map(c=>({...c,translated:map.get(String(c.id))||c.text}));
}