const $=id=>document.getElementById(id);
(async()=>{
 const s=await chrome.storage.local.get(["apiKey","model","enabled"]);
 $("enabled").checked=!!s.enabled;
 $("status").textContent=s.apiKey?("Model: "+(s.model||"chọn model trong Cài đặt")):"Chưa cấu hình OpenRouter";
 $("enabled").addEventListener("change",async e=>{
   await chrome.storage.local.set({enabled:e.target.checked});
   const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
   if(tab?.id) chrome.tabs.sendMessage(tab.id,{type:"SET_ENABLED",enabled:e.target.checked}).catch(()=>{});
 });
 $("start").onclick=async()=>{
   const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
   if(tab?.id) chrome.tabs.sendMessage(tab.id,{type:"SET_ENABLED",enabled:true}).catch(()=>{});
 };
 $("settings").onclick=()=>chrome.runtime.sendMessage({type:"OPEN_OPTIONS"});
})();