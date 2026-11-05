import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import {spawn} from "node:child_process";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//,"Disposable localhost Mongo required");
const {publicKey}=generateKeyPairSync("rsa",{modulusLength:2048,publicKeyEncoding:{format:"pem",type:"spki"},privateKeyEncoding:{format:"pem",type:"pkcs8"}});
const port=31880;
const env={PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:"test",PORT:String(port),MONGO_URI:uri,MOVIE_MENTOR_ALLOWED_BROWSER_ORIGINS:"https://isolated.example",MOVIE_MENTOR_CLERK_JWT_KEY:publicKey,MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify(["https://isolated.example"]),MOVIE_MENTOR_CLERK_ISSUER:"https://isolated-issuer.example",MOVIE_MENTOR_AUDIENCE:"isolated-audience"};
const child=spawn(process.execPath,["server.js"],{env,stdio:["ignore","pipe","pipe"]});
let logs="";for(const stream of [child.stdout,child.stderr])stream.on("data",part=>{logs+=part.toString()});
try{
 let health=null;
 for(let attempt=0;attempt<100;attempt++){try{health=await fetch("http://127.0.0.1:"+port+"/health");if(health.ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 assert.equal(health?.status,200,"Real server must boot: "+logs);
 assert.doesNotMatch(logs,/\[mount:ok\] \/api\/movie-mentor <-/,"Gateway must not mount without complete durable inference and atomic readiness");
 assert.match(logs,/\[mount:closed\] \/api\/movie-mentor \((?!production-authentication-unconfigured)[^)]+\)/,"Configured authentication must advance to a later fail-closed dependency: "+logs);
 const response=await fetch("http://127.0.0.1:"+port+"/api/movie-mentor/state/sync",{method:"POST",headers:{Origin:"https://isolated.example","Content-Type":"application/json"},body:"{}"});
 assert.notEqual(response.status,200,"Configured auth alone cannot authorize a creator mutation");
 console.log("GREEN: real server with ephemeral configured Clerk public key advances beyond unconfigured-auth denial but refuses to mount incomplete creator gateway; no production credentials or database.");
}finally{child.kill("SIGTERM");}
