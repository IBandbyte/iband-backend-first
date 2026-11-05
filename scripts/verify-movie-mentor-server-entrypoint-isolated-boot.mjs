import assert from "node:assert/strict";
import {spawn} from "node:child_process";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\//.test(uri||""),"Isolated local Mongo required");
const port=31879;
const child=spawn(process.execPath,["server.js"],{env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:"test",PORT:String(port),MONGO_URI:uri,MOVIE_MENTOR_ALLOWED_BROWSER_ORIGINS:"https://isolated.example"},stdio:["ignore","pipe","pipe"]});
let logs="";for(const stream of [child.stdout,child.stderr])stream.on("data",part=>{logs+=part.toString();});
try{
 let response;
 for(let attempt=0;attempt<80;attempt++){
  try{response=await fetch("http://127.0.0.1:"+port+"/health");if(response.ok)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.equal(response?.status,200,"Actual server.js health response required: "+logs);
 assert.equal((await response.json()).ok,true);
 const denied=await fetch("http://127.0.0.1:"+port+"/api/movie-mentor/state/sync",{method:"POST",headers:{"Origin":"https://untrusted.example","Content-Type":"application/json"},body:"{}"});
 assert.equal(denied.status,403,"Untrusted browser origin must be denied");
 assert.match(logs,/\[mount:closed\] \/api\/movie-mentor/,"Creator gateway must remain closed without production authority");
 console.log("GREEN: real server entrypoint booted with isolated Mongo and enforced browser-origin denial; authenticated production composition remains unverified.");
}finally{child.kill("SIGTERM");}
