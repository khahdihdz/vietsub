const ids=["apiKey","model","temperature","prompt"];
(async()=>{
  const s=await chrome.storage.local.get(ids);
  ids.forEach(id=>{if(s[id]!=null)document.getElementById(id).value=s[id]});
  document.getElementById("save").onclick=async()=>{
    const o={};ids.forEach(id=>o[id]=document.getElementById(id).value.trim());
    await chrome.storage.local.set(o);
    document.getElementById("msg").textContent="Đã lưu";
    document.getElementById("msg").className="ok";
  };
})();