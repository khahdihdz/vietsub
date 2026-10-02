export function parseSrt(input){
 const blocks=input.replace(/\r/g,"").trim().split(/\n\s*\n/);
 return blocks.map((b,i)=>{
   const lines=b.split("\n"), m=lines.findIndex(x=>x.includes("-->"));
   if(m<0)return null; const times=lines[m].split("-->");
   const toSec=s=>{const [h,mm,rest]=s.trim().replace(",",".").split(":");return +h*3600+ +mm*60+ +rest};
   return {id:String(i+1),start:toSec(times[0]),end:toSec(times[1]),text:lines.slice(m+1).join("\n").trim()};
 }).filter(Boolean);
}