const ids=["apiKey","model","prompt"];
(async()=>{
 const s=await chrome.storage.local.get(ids);
 for(const id of ids) if(s[id]!=null) document.getElementById(id).value=s[id];
 document.getElementById("save").onclick=async()=>{
   const out={}; for(const id of ids) out[id]=document.getElementById(id).value.trim();
   await chrome.storage.local.set(out);
   document.getElementById("msg").textContent="Đã lưu.";
   document.getElementById("msg").className="ok";
 };
})();