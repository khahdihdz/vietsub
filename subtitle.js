export function parseTime(s){
  const p=s.trim().replace(",",".").split(":");
  return p.length===3?Number(p[0])*3600+Number(p[1])*60+Number(p[2]):Number(p[0])*60+Number(p[1]);
}
export function parseSrt(x){
  return x.replace(/\r/g,"").trim().split(/\n\s*\n/).map((b,i)=>{
    const l=b.split("\n"),k=l.findIndex(v=>v.includes("-->"));
    if(k<0)return null;
    const q=l[k].split("-->");
    return{id:String(i+1),start:parseTime(q[0]),end:parseTime(q[1]),text:l.slice(k+1).join("\n").replace(/<[^>]+>/g,"").trim()};
  }).filter(Boolean);
}
export function parseVtt(x){return parseSrt(x.replace(/^WEBVTT[^\n]*\n/i,""));}
export function toSrt(cues){
  return cues.map((c,i)=>String(i+1)+"\n"+fmt(c.start)+" --> "+fmt(c.end)+"\n"+(c.translated||c.text)+"\n").join("\n");
}
function fmt(t){
  const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=Math.floor(t%60),ms=Math.floor((t-Math.floor(t))*1000);
  return [h,m,s].map(v=>String(v).padStart(2,"0")).join(":")+","+String(ms).padStart(3,"0");
}
export function download(text,name,type="text/plain"){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}