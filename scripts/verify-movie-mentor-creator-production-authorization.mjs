import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorCreatorRequestAuthority } from "../ai/MovieMentorCreatorRequestAuthority.js";
import { createMovieMentorProductionAuthenticationComposition } from "../ai/MovieMentorProductionAuthenticationComposition.js";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

console.log("5A.1 — creator-facing production authentication & project ownership torture");

function verifiedPrincipalAdapter({ principalId="creator-1" }={}) { return async ({ request }) => { if (!request?.headers?.authorization) { const e=new Error("credential required"); e.code="MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED"; throw e; } return Object.freeze({authenticated:true,principalId,authenticationSource:"synthetic-verified-principal"}); }; }
function ownershipAuthority(owner="creator-1") { return { async authorizeProject({principal,projectId}) { return principal?.principalId===owner ? Object.freeze({authorized:true,projectId,ownershipRef:`ownership:${projectId}`,ownershipRevision:1,authorizationSource:"synthetic-ownership"}) : Object.freeze({authorized:false,projectId,reason:"principal-not-owner"}); } }; }

{
 let ownershipCalls=0;
 const authority=createMovieMentorCreatorRequestAuthority({verifyCredential:async()=>({}),derivePrincipal:verifiedPrincipalAdapter(),ownershipAuthority:{async authorizeProject(){ownershipCalls++;return{authorized:true};}}});
 await assert.rejects(()=>authority.authorize({request:{headers:{authorization:"Bearer token"}},projectId:""}),e=>e.code==="MOVIE_MENTOR_CREATOR_PROJECT_REQUIRED");
 assert.equal(ownershipCalls,0);
}
{
 const authority=createMovieMentorCreatorRequestAuthority({verifyCredential:async()=>({}),derivePrincipal:verifiedPrincipalAdapter(),ownershipAuthority:ownershipAuthority()});
 await assert.rejects(()=>authority.authorize({request:{headers:{}},projectId:"project-1"}),e=>e.code==="MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED");
}
{
 const authority=createMovieMentorCreatorRequestAuthority({verifyCredential:async()=>({}),derivePrincipal:verifiedPrincipalAdapter({principalId:"intruder"}),ownershipAuthority:ownershipAuthority("creator-1")});
 await assert.rejects(()=>authority.authorize({request:{headers:{authorization:"Bearer token"},body:{userId:"creator-1",principalId:"creator-1"}},projectId:"project-1"}),e=>e.code==="MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED");
}
{
 const authority=createMovieMentorCreatorRequestAuthority({verifyCredential:async()=>({}),derivePrincipal:verifiedPrincipalAdapter(),ownershipAuthority:ownershipAuthority()});
 const result=await authority.authorize({request:{headers:{authorization:"Bearer token"},body:{userId:"intruder",principalId:"intruder"}},projectId:"project-1"});
 assert.equal(result.authorized,true);assert.equal(result.principalId,"creator-1");assert.equal(result.projectId,"project-1");assert.equal(Object.isFrozen(result),true);
}
{
 const none=createMovieMentorProductionAuthenticationComposition({env:{},createVerifier:()=>{throw new Error("must not construct verifier");}});assert.equal(none.ready,false);assert.equal(none.reason,"production-authentication-unconfigured");
 const partial=createMovieMentorProductionAuthenticationComposition({env:{MOVIE_MENTOR_CLERK_JWT_KEY:"key"},createVerifier:()=>{throw new Error("must not construct verifier");}});assert.equal(partial.ready,false);assert.equal(partial.reason,"production-authentication-partially-configured");
 const verifyCredential=async()=>({verified:true});
 const full=createMovieMentorProductionAuthenticationComposition({env:{MOVIE_MENTOR_CLERK_JWT_KEY:"PUBLIC",MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:'["https://app.example.com"]',MOVIE_MENTOR_CLERK_ISSUER:"https://issuer.example.com",MOVIE_MENTOR_AUDIENCE:"movie-mentor"},createVerifier:()=>({version:"test",domain:"test",authorizedParties:["https://app.example.com"],verifyCredential})});
 assert.equal(full.ready,true);assert.equal(full.verifyCredential,verifyCredential);assert.equal(full.expectedIssuer,"https://issuer.example.com");assert.equal(full.expectedAudience,"movie-mentor");
}
{
 assert.throws(()=>createMovieMentorTurnRouter({}),e=>e.code==="MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_REQUIRED");
 let runCalls=0,stateCalls=0,authorityCalls=0;
 const router=createMovieMentorTurnRouter({requestAuthority:{async authorize({projectId}){authorityCalls++;if(projectId!=="project-1"){const e=new Error("denied");e.code="MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED";throw e;}return{authorized:true,projectId,ownershipRef:"ownership:project-1"};}},runTurn:async(input)=>{runCalls++;return{success:true,projectId:input.projectId};},applyStateTransition:async(input)=>{stateCalls++;return{projectId:input.projectId};}});
 const turnLayer=router.stack.find(layer=>layer.route?.path==="/turn");const syncLayer=router.stack.find(layer=>layer.route?.path==="/state/sync");
 const response=()=>({statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){this.payload=value;return this;}});
 let res=response();await turnLayer.route.stack[0].handle({body:{creatorSessionId:"session-only"},headers:{authorization:"Bearer token"}},res);assert.equal(res.statusCode,400);assert.equal(runCalls,0);
 res=response();await turnLayer.route.stack[0].handle({body:{projectId:"other-project",userId:"creator-1"},headers:{authorization:"Bearer token"}},res);assert.equal(res.statusCode,403);assert.equal(runCalls,0);
 res=response();await turnLayer.route.stack[0].handle({body:{projectId:"project-1",principalId:"intruder"},headers:{authorization:"Bearer token"}},res);assert.equal(res.statusCode,200);assert.equal(runCalls,1);assert.equal(res.payload.projectId,"project-1");
 res=response();await syncLayer.route.stack[0].handle({body:{projectId:"project-1",state:{projectJourney:{stage:"idea"}}},headers:{authorization:"Bearer token"}},res);assert.equal(res.statusCode,200);assert.equal(stateCalls,1);assert.equal(authorityCalls,4);
}

const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
assert.match(server,/createMovieMentorProductionAuthenticationComposition/);assert.match(server,/createMovieMentorCreatorRequestAuthority/);assert.match(server,/createMovieMentorTurnRouter/);assert.match(server,/app\.use\("\/api\/movie-mentor",router\)/);assert.doesNotMatch(server,/mountRoute\("\/api\/movie-mentor","\.\/movieMentorTurn\.js"\)/);
const gateway=fs.readFileSync(new URL("../movieMentorTurn.js",import.meta.url),"utf8");assert.match(gateway,/requestAuthority\.authorize/);assert.match(gateway,/projectId/);assert.doesNotMatch(gateway,/creatorSessionId.*authorize/);

console.log("✓ projectId is mandatory before ownership evaluation");
console.log("✓ missing credential fails before project access");
console.log("✓ forged body identity cannot impersonate the durable owner");
console.log("✓ authenticated owner receives frozen project authority");
console.log("✓ production authentication is fail-closed when absent or partial");
console.log("✓ session-only requests cannot reach turn execution");
console.log("✓ wrong-project requests cause zero turn execution");
console.log("✓ valid owner authority reaches turn and state handlers");
console.log("✓ server cannot expose creator gateway through generic mountRoute");
console.log("LAW: project identity is reference; authenticated ownership is authority");
console.log("5A.1 torture: GREEN");
