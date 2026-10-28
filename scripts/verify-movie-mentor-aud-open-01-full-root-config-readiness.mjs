import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import net from "node:net";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated Mongo required");
const socket=net.createServer();
await new Promise((resolve,reject)=>socket.once("error",reject).listen(0,"127.0.0.1",resolve));
const port=socket.address().port;
await new Promise(resolve=>socket.close(resolve));
const env={...process.env,PORT:String(port),MOVIE_MENTOR_STRIPE_SECRET_KEY:""};
const child=spawn(process.execPath,["server.js"],{env,stdio:["ignore","pipe","pipe"]});
let out="",err="";
child.stdout.on("data",x=>out+=x);
child.stderr.on("data",x=>err+=x);
try{
 const deadline=Date.now()+20000;
 let health=null;
 while(Date.now()<deadline){
  if(child.exitCode!==null)throw Error("root exited before listening: "+out.slice(-1000)+" "+err.slice(-1000));
  try{
   const res=await fetch("http://127.0.0.1:"+port+"/health",{signal:AbortSignal.timeout(1000)});
   if(res.status===200){health=await res.json();break;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.deepEqual(health,{ok:true},"actual root health must respond");
 assert.match(out,/\[mount:closed\] \/api\/movie-mentor\/commercial\/providers\/stripe\/webhook/,"actual root commercial ingress must report closed");
 const webhook=await fetch("http://127.0.0.1:"+port+"/api/movie-mentor/commercial/providers/stripe/webhook",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
 assert.notEqual(webhook.status,200,"unmounted webhook must not acknowledge delivery");
 console.log("AUD ROOT BOOT CONFIGURATION COURT GREEN: actual server.js listening, /health 200 while commercial ingress closed; webhook not accepted; configuration-only, NOT a recovery-failure court");
}finally{
 child.kill("SIGKILL");
 await new Promise(resolve=>child.once("exit",resolve));
}
