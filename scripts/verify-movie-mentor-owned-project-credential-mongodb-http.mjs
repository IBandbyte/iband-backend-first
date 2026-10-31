import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import {deriveMovieMentorPrincipal} from "../ai/MovieMentorDeterministicPrincipalAdapter.js";
import {createMovieMentorCreatorRequestAuthority} from "../ai/MovieMentorCreatorRequestAuthority.js";
import {createMovieMentorProjectOwnershipAuthority,listMovieMentorOwnedProjectIdentities} from "../ai/MovieMentorProjectOwnershipRegistry.js";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
assert.match(process.env.MONGO_URI||"",/^mongodb:\/\/127\.0\.0\.1:27017\/movie_mentor_recovery_ci$/);
const issuer="isolated-ci-issuer",audience="isolated-ci-audience";
const verifyCredential=async({credential})=>{
 if(!["creator-a","creator-b"].includes(credential))throw Object.assign(new Error("Invalid credential"),{code:"MOVIE_MENTOR_AUTH_VERIFICATION_FAILED"});
 return {verified:true,subject:credential,issuer,audience,verificationMethod:"isolated-test-verifier",verificationVersion:"1",authenticatedAt:new Date(Date.now()-10000),expiresAt:new Date(Date.now()+60000)};
};
const ownershipAuthority=createMovieMentorProjectOwnershipAuthority();
const requestAuthority=createMovieMentorCreatorRequestAuthority({verifyCredential,expectedIssuer:issuer,expectedAudience:audience,ownershipAuthority});
const spend={reserveTurn(){},readReservation(){}};
const execution=Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"].map(k=>[k,()=>{}]));
const settlement={reconcile(){},releaseUnclaimed(){},releaseUnbound(){}};
await mongoose.connect(process.env.MONGO_URI);
const collection=mongoose.connection.db.collection("movie_mentor_project_ownership");
const ids=["discovery-http-a","discovery-http-b"];
await collection.deleteMany({projectId:{$in:ids}});
const make=(projectId,ownerPrincipalId)=>({domain:"iband.movie-mentor.project-ownership",schema:1,projectId,ownerPrincipalId,ownershipRevision:1,ownershipReference:"proof-"+projectId,establishmentAuthorityId:"establish-"+projectId,establishmentSource:"native-project-establishment",status:"active",establishedAt:new Date()});
await collection.insertMany([make(ids[0],"creator-a"),make(ids[1],"creator-b")]);
const app=express();
app.use("/api/movie-mentor",createMovieMentorTurnRouter({requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,authenticateDiscovery:({request})=>deriveMovieMentorPrincipal({request,verifyCredential,expectedIssuer:issuer,expectedAudience:audience}),listOwnedProjects:listMovieMentorOwnedProjectIdentities}));
const server=app.listen(0,"127.0.0.1");
try{
 await new Promise(resolve=>server.once("listening",resolve));
 const url=`http://127.0.0.1:${server.address().port}/api/movie-mentor/projects/owned`;
 const call=async(token,query="")=>{const response=await fetch(url+query,{headers:token?{authorization:`Bearer ${token}`}:{}});return{status:response.status,body:await response.json()};};
 assert.equal((await call(null)).status,401);
 assert.equal((await call("invalid")).status,401);
 const a=await call("creator-a","?ownerPrincipalId=creator-b");
 const b=await call("creator-b","?ownerPrincipalId=creator-a");
 assert.equal(a.status,200);assert.deepEqual(a.body.projects,[{projectId:ids[0]}]);
 assert.equal(b.status,200);assert.deepEqual(b.body.projects,[{projectId:ids[1]}]);
 console.log("GREEN: verified credential to physical MongoDB owner listing to authenticated HTTP response, with cross-creator isolation.");
}finally{
 await new Promise(resolve=>server.close(resolve));
 await collection.deleteMany({projectId:{$in:ids}});
 await mongoose.disconnect();
}
