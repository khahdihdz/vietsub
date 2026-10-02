import{parseSrt,parseVtt,toSrt,download}from "./subtitle.js";
const $=x=>document.getElementById(x);
let cues=[],enabled=true,dubbing=false;
function msg(x,ok=false){$("status").textContent=x;$("status").className=ok?"status ok":"status"}
async function tabMessage(m){
  const[t]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!t?.id)throw Error("Không tìm thấy tab");
  return chrome.tabs.sendMessage(t.id,m);
}
$("file").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  const x=await f.text();
  cues=f.name.toLowerCase().endsWith(".vtt")?parseVtt(x):parseSrt(x);
  msg("Đã nạp "+cues.length+" câu phụ đề",true);
  await tabMessage({type:"SET_CUES",cues});
};
$("translate").onclick=async()=>{
  if(!cues.length){msg("Hãy nạp SRT/VTT trước.");return}
  msg("Đang dịch bằng OpenRouter...");
  const r=await chrome.runtime.sendMessage({type:"TRANSLATE",cues:cues.map(({id,text})=>({id,text}))}).catch(e=>({ok:false,error:e.message}));
  if(!r?.ok){msg(r?.error||"Không thể gọi OpenRouter.");return}
  const map=new Map((r.result||[]).map(x=>[String(x.id),x.translation]));
  cues=cues.map(c=>({...c,translated:map.get(String(c.id))||c.text}));
  await tabMessage({type:"SET_CUES",cues});
  download(toSrt(cues),"vietsub-vi.srt","text/srt");
  msg("Dịch xong và đã tải SRT.",true);
};
$("sub").onclick=async()=>{
  enabled=!enabled;
  $("sub").textContent="Phụ đề: "+(enabled?"BẬT":"TẮT");
  await tabMessage({type:"SET_ENABLED",enabled});
};
$("dub").onclick=async()=>{
  dubbing=!dubbing;
  $("dub").textContent="Thuyết minh: "+(dubbing?"BẬT":"TẮT");
  await tabMessage({type:"SET_DUBBING",enabled:dubbing,style:{rate:1,volume:1}});
};
$("settings").onclick=()=>chrome.runtime.openOptionsPage();
(async()=>{
  const s=await chrome.storage.local.get(["apiKey","model"]);
  msg(s.apiKey?"Sẵn sàng • "+(s.model||"model mặc định"):"Chưa cấu hình OpenRouter");
})();