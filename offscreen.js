let stream=null, recorder=null, running=false, tabId=null, startTime=0, chunkId=0, chunkStart=0;
chrome.runtime.onMessage.addListener(async m=>{
  if(m.type==="OFFSCREEN_START_CAPTURE"){await start(m.streamId,m.tabId,Number(m.startTime||0));}
  if(m.type==="OFFSCREEN_STOP_CAPTURE"){stop();}
});
async function start(streamId,id,base){
  stop();tabId=id;startTime=base;chunkStart=base;running=true;
  stream=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:"tab",chromeMediaSourceId:streamId}},video:false});
  const ctx=new AudioContext();const source=ctx.createMediaStreamSource(stream);source.connect(ctx.destination);
  loop();
}
async function loop(){
  while(running&&stream){
    const startedAt=chunkStart;
    const rec=new MediaRecorder(stream,{mimeType:"audio/webm;codecs=opus"});
    recorder=rec;const parts=[];
    rec.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
    const done=new Promise(resolve=>{rec.onstop=()=>resolve()});
    rec.start();
    await new Promise(r=>setTimeout(r,10000));
    if(rec.state!=="inactive")rec.stop();
    await done;
    if(!running)break;
    const blob=new Blob(parts,{type:"audio/webm"});
    const data=await toBase64(blob);
    const duration=10;
    chrome.runtime.sendMessage({type:"AUTO_SUBTITLE_CHUNK",tabId,startTime:startedAt,duration,chunkId:chunkId++,data,format:"webm"});
    chunkStart+=duration;
  }
}
function stop(){running=false;try{if(recorder&&recorder.state!=="inactive")recorder.stop()}catch{}recorder=null;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
function toBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=reject;r.readAsDataURL(blob)})}