import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createMovieMentorCreatorStateReadExpressRouter } from "../ai/MovieMentorCreatorStateReadExpressRouter.js";
import { createMovieMentorProductionAuthenticationComposition } from "../ai/MovieMentorProductionAuthenticationComposition.js";
import { generateKeyPairSync, createSign } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const issuer="https://issuer.example.test", audience="movie-mentor-read", authorizedParty="https://studio.example.test";
const authentication=createMovieMentorProductionAuthenticationComposition({env:{
 MOVIE_MENTOR_CLERK_JWT_KEY:publicKey.export({type:"spki",format:"pem"}),
 MOVIE_MENTOR_CLERK_ISSUER:issuer,
 MOVIE_MENTOR_AUDIENCE:audience,
 MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify([authorizedParty]),
}});
assert.equal(authentication.ready,true,"RED: genuine pinned-key authentication unavailable");
function token(subject) {
 const now=Math.floor(Date.now()/1000);
 const encode=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
 const input=encode({alg:"RS256",typ:"JWT"})+"."+encode({iss:issuer,aud:audience,azp:authorizedParty,sub:subject,sid:"sess_read",iat:now,nbf:now-5,exp:now+120});
 const signature=createSign("RSA-SHA256").update(input).end().sign(privateKey).toString("base64url");
 return input+"."+signature;
}
const owner="user_owner", foreign="user_foreign", projectId="project_read";
const events=[];
const router=createMovieMentorCreatorStateReadExpressRouter({
 authentication,
 ownershipAuthority:{async authorizeProject({principal,projectId:pid}) {
  events.push("owner:"+principal.principalId);
  return principal.principalId===owner&&pid===projectId
   ? {authorized:true,projectId:pid,ownershipRef:"ref",ownershipRevision:1}
   : {authorized:false,projectId:pid};
 }},
 async readCreatorState({projectId:pid}) {
  events.push("mongo:"+pid);
  return {projectId:pid,revision:1,creatorStateGeneration:1};
 },
 async discoverOwnedProjects({principal}) {
  events.push("discover:"+principal.principalId);
  return {authorized:true,projects:[{projectId}]};
 },
});
const app=express();app.use("/api/movie-mentor",router);
const server=createServer(app);
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
try {
 const base="http://127.0.0.1:"+server.address().port;
 async function get(path,bearer) {
  const response=await fetch(base+path,{headers:bearer?{Authorization:"Bearer "+bearer}:{}});
  return {status:response.status,body:await response.json()};
 }
 const owned=await get("/api/movie-mentor/projects/owned",token(owner));
 assert.equal(owned.status,200);assert.deepEqual(owned.body,{success:true,projects:[{projectId}]});
 const before=events.length;
 assert.equal((await get("/api/movie-mentor/projects/owned",token(foreign))).status,200,"RED: injected discovery must not claim foreign projects");
 assert.equal((await get("/api/movie-mentor/projects/owned","forged")).status,401);
 assert.equal(events.length,before+1,"RED: forged JWT reached discovery authority");
 const recovery=await get("/api/movie-mentor/state/recovery/"+projectId,token(owner));
 assert.equal(recovery.status,200);assert.equal(recovery.body.state.projectId,projectId);
 assert.equal((await get("/api/movie-mentor/state/recovery/"+projectId,token(foreign))).status,403);
 assert.equal((await get("/api/movie-mentor/state/recovery/"+projectId,"forged")).status,401);
 const post=await fetch(base+"/api/movie-mentor/state/recovery/"+projectId,{method:"POST"});
 assert.equal(post.status,404,"RED: read-only router must not allow POST");
 console.log("GREEN: actual Express signed RS256 GET recovery and discovery, foreign recovery denial, forged JWT denial, POST denial");
} finally { await new Promise(resolve=>server.close(resolve)); }
