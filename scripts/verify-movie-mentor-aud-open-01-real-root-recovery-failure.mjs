// Verifier-only real-root recovery failure court. Run immediately after
// verify-movie-mentor-aud-open-01-startup-readiness-failure.mjs, before DB reset.
// No production module monkey-patching, no production database, no deployment.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {generateKeyPairSync} from "node:crypto";
import net from "node:net";
import mongoose from "mongoose";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated MongoDB required");
const appName="aud433-real-root-recovery-failure";
const rootUri=uri+(uri.includes("?")?"&":"?")+"appName="+appName;
const payment="pi_aud_signed_ingress",evidenceId="evt_aud_signed_ingress";
const webhookPath="/api/movie-mentor/commercial/providers/stripe/webhook";
const secret="whsec_aud_open_01_signed_ingress";
const timeoutMs=30000;
const {publicKey}=generateKeyPairSync("rsa",{modulusLength:2048,publicKeyEncoding:{type:"spki",format:"pem"},privateKeyEncoding:{type:"pkcs8",format:"pem"}});
const socket=net.createServer();
await new Promise((resolve,reject)=>socket.once("error",reject).listen(0,"127.0.0.1",resolve));
const port=socket.address().port;
await new Promise(resolve=>socket.close(resolve));
const env={
 ...process.env,
 PORT:String(port),
 MONGO_URI:rootUri,
 MONGODB_URI:rootUri,
 MOVIE_MENTOR_CLERK_JWT_KEY:publicKey,
 MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify(["https://app.example.com"]),
 MOVIE_MENTOR_CLERK_ISSUER:"https://issuer.example.com",
 MOVIE_MENTOR_AUDIENCE:"movie-mentor",
 MOVIE_MENTOR_COMMERCIAL_POLICY_JSON:JSON.stringify([{packageId:"aud-package",provider:"stripe",providerProductId:"aud-product",amountMinor:1200,currency:"GBP",environment:"test",units:20,policyVersion:"aud-fixture"}]),
 MOVIE_MENTOR_STRIPE_SECRET_KEY:"sk_test_aud_open_01_no_network",
 MOVIE_MENTOR_STRIPE_WEBHOOK_SECRET:secret,
 MOVIE_MENTOR_STRIPE_SUCCESS_URL:"https://example.invalid/success",
 MOVIE_MENTOR_STRIPE_CANCEL_URL:"https://example.invalid/cancel"
};
let child=null,stdout="",stderr="",failpointEnabled=false;
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
const db=mongoose.connection.db;
try{
 assert.ok((await db.admin().command({hello:1})).setName,"replica-set MongoDB required");
 const receipt=await db.collection("movie_mentor_commercial_reversal").findOne({evidenceSource:"stripe",evidenceId});
 assert.ok(receipt&&receipt.status==="suspended"&&receipt.evidenceKind==="charge.dispute.funds_withdrawn","genuine signed-ingress reversal receipt fixture required");
 const before=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:payment});
 assert.ok(before&&before.status==="preserved-credit"&&!(before.chargebackEvents||[]).some(e=>e.reference===evidenceId),"recovery settlement must be outstanding before root starts");
 // MongoDB's test-only failCommand matches only root's driver application name.
 // The parent verifier has no such appName, so fixture reads and checks are unaffected.
 const configured=await db.admin().command({configureFailPoint:"failCommand",mode:{times:1},data:{failCommands:["findAndModify"],appName,errorCode:2}});
 failpointEnabled=true;
 const initialCount=configured.count??0;
 child=spawn(process.execPath,["server.js"],{env,stdio:["ignore","pipe","pipe"]});
 child.stdout.on("data",data=>{stdout+=data.toString();});
 child.stderr.on("data",data=>{stderr+=data.toString();});
 let health=null;
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){
  if(child.exitCode!==null)throw Error("real root exited before health: "+stdout.slice(-1600)+" "+stderr.slice(-1600));
  try{
   const response=await fetch("http://127.0.0.1:"+port+"/health",{signal:AbortSignal.timeout(1000)});
   if(response.status===200){health=await response.json();break;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.deepEqual(health,{ok:true},"actual server.js must return /health HTTP 200");
 assert.match(stdout,/\[mount:closed\] \/api\/movie-mentor\/commercial\/providers\/stripe\/webhook \(2\)/,"root must close commercial ingress on injected MongoDB writer error 2");
 assert.doesNotMatch(stdout,/\[mount:provider-ok\] \/api\/movie-mentor\/commercial\/providers\/stripe\/webhook/,"root must not register commercial ingress");
 const webhook=await fetch("http://127.0.0.1:"+port+webhookPath,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
 assert.equal(webhook.status,404,"closed commercial ingress must leave Stripe webhook absent");
 const after=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:payment});
 assert.ok(after&&!(after.chargebackEvents||[]).some(e=>e.reference===evidenceId),"injected writer failure must leave settlement unapplied");
 // Disable failpoint before reading trigger count: returned count is cumulative.
 const disabled=await db.admin().command({configureFailPoint:"failCommand",mode:"off"});
 failpointEnabled=false;
 assert.equal(disabled.count,initialCount+1,"exactly one root-only findAndModify must have been failed");
 console.log("AUD REAL ROOT STARTUP RECOVERY FAILURE GREEN: signed ingress receipt durable; isolated root-only findAndModify failure triggered exactly once; actual server.js /health 200; commercial mount closed; webhook absent; chargeback settlement outstanding");
}finally{
 if(child){
  if(child.exitCode===null){child.kill("SIGKILL");await new Promise(resolve=>child.once("exit",resolve));}
 }
 if(failpointEnabled){
  try{await db.admin().command({configureFailPoint:"failCommand",mode:"off"});}
  catch(error){console.error("AUD FAILPOINT CLEANUP FAILED",error);throw error;}
 }
 await mongoose.disconnect();
}
