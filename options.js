const ids=["apiKey","model","sttModel","temperature","prompt"];
(async()=>{
  const s=await chrome.storage.local.get([...ids,"autoTranslate"]);
  ids.forEach(id=>{if(s[id]!=null)document.getElementById(id).value=s[id]});
  document.getElementById("autoTranslate").checked=s.autoTranslate!==false;
  document.getElementById("save").onclick=async()=>{
    const o={};ids.forEach(id=>o[id]=document.getElementById(id).value.trim());
    o.autoTranslate=document.getElementById("autoTranslate").checked;
    await chrome.storage.local.set(o);
    document.getElementById("msg").textContent="Đã lưu";
    document.getElementById("msg").className="ok";
  };
})();