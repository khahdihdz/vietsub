let stream=null,recorder=null,audioContext=null,source=null,monitorGain=null,recordGain=null,recordDestination=null,running=false,tabId=null,chunkId=0,chunkStart=0;

chrome.runtime.onMessage.addListener(async m=>{
  if(m.type==="OFFSCREEN_START_CAPTURE"){
    try{
      await start(m.streamId,m.tabId,Number(m.startTime||0));
    }catch(e){
      chrome.runtime.sendMessage({type:"OFFSCREEN_CAPTURE_ERROR",tabId:m.tabId,error:e?.message||String(e)});
    }
  }
  if(m.type==="OFFSCREEN_STOP_CAPTURE") stop();
});

async function start(streamId,id,base){
  stop();
  tabId=id;
  chunkStart=base;
  running=true;

  stream=await navigator.mediaDevices.getUserMedia({
    audio:{mandatory:{chromeMediaSource:"tab",chromeMediaSourceId:streamId}},
    video:false
  });

  // tabCapture can redirect captured audio away from the page. Send one
  // copy back to the audio output and another copy to the STT recorder.
  audioContext=new AudioContext();
  await audioContext.resume().catch(()=>{});
  source=audioContext.createMediaStreamSource(stream);

  monitorGain=audioContext.createGain();
  monitorGain.gain.value=1;
  source.connect(monitorGain);
  monitorGain.connect(audioContext.destination);

  recordDestination=audioContext.createMediaStreamDestination();
  recordGain=audioContext.createGain();
  recordGain.gain.value=1;
  source.connect(recordGain);
  recordGain.connect(recordDestination);

  loop(recordDestination.stream);
}

async function loop(recordStream){
  while(running&&recordStream){
    const startedAt=chunkStart;
    const rec=new MediaRecorder(recordStream,{mimeType:"audio/webm;codecs=opus"});
    recorder=rec;
    const parts=[];
    rec.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
    const done=new Promise(resolve=>{rec.onstop=()=>resolve()});
    rec.start();

    await new Promise(r=>setTimeout(r,10000));
    if(rec.state!=="inactive")rec.stop();
    await done;
    if(!running)break;

    const blob=new Blob(parts,{type:"audio/webm"});
    const data=await toBase64(blob);
    chrome.runtime.sendMessage({
      type:"AUTO_SUBTITLE_CHUNK",
      tabId,
      startTime:startedAt,
      duration:10,
      chunkId:chunkId++,
      data,
      format:"webm"
    });
    chunkStart+=10;
  }
}

function stop(){
  running=false;
  try{if(recorder&&recorder.state!=="inactive")recorder.stop()}catch{}
  recorder=null;
  try{
    source?.disconnect();
    monitorGain?.disconnect();
    recordGain?.disconnect();
  }catch{}
  source=null;
  monitorGain=null;
  recordGain=null;
  recordDestination=null;
  if(audioContext){try{audioContext.close()}catch{}}
  audioContext=null;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
}

function toBase64(blob){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result).split(",")[1]);
    r.onerror=reject;
    r.readAsDataURL(blob);
  });
}