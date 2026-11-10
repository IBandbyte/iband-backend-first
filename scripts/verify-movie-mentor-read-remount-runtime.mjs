import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Execute the actual server mount function with isolated injected dependencies.
// Never import server.js: that would start a real listener and production boot.
const source=readFileSync(new URL("../server.js",import.meta.url),"utf8");
const start=source.indexOf("let movieMentorReadOnlyRecoveryIngressMounted=false;");
const end=source.indexOf("await mountMovieMentorNativeProjectCreationIngress();",start);
assert.ok(start>=0&&end>start,"RED: actual server read-only mount section must be present");
const section=source.slice(start,end);
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
const mongo={connection:{readyState:0}};
const mounts=[];
let gate=null;
let readinessCalls=0;
const authentication={ready:true,getStatus:()=>({ready:true})};
const ownership={getStatus:()=>({ready:true})};
const context={
  mongoose:mongo,
  app:{use:(path,router)=>mounts.push({path,router})},
  console:{log:()=>{}},
  createMovieMentorProductionAuthenticationComposition:()=>authentication,
  authenticationCompositionProven:()=>true,
  movieMentorProjectOwnershipAuthority:ownership,
  ownershipAuthorityProven:()=>true,
  createMovieMentorCreatorStateAtomicCompositionFromMongoose:()=>({atomicCreatorStateReadiness:{}}),
  assertMovieMentorCreatorGatewayAtomicMountReadiness:async()=>{
    readinessCalls++;
    if(gate)await gate.promise;
  },
  createMovieMentorCreatorStateRecoveryProductionComposition:()=>({}),
  createMovieMentorCreatorStateReadExpressRouter:()=>({isolatedRouter:true}),
  readAuthoritativeTurnSource:async()=>null,
};
runInNewContext(section+"\nthis.mount=mountMovieMentorReadOnlyRecoveryIngress;",context);
const mount=context.mount;
const denied=await mount();
assert.equal(denied.mounted,false,"RED: unavailable Mongo must fail closed");
assert.equal(mounts.length,0,"RED: unavailable Mongo must not register route");
mongo.connection.readyState=1;
gate=deferred();
const first=mount();
const second=mount();
assert.equal(first,second,"RED: concurrent callers must share exactly the same in-flight promise");
await Promise.resolve();
assert.equal(readinessCalls,1,"RED: concurrent recovery must execute readiness only once");
assert.equal(mounts.length,0,"RED: pending readiness must not register routes");
gate.resolve();
const [one,two]=await Promise.all([first,second]);
assert.equal(one.mounted,true);
assert.equal(two.mounted,true);
assert.equal(mounts.length,1,"RED: concurrent recovery must register only one router");
assert.equal(mounts[0].path,"/api/movie-mentor");
const repeated=await mount();
assert.equal(repeated.mounted,true);
assert.equal(mounts.length,1,"RED: already-mounted read ingress must remain idempotent");
console.log("GREEN RUNTIME SINGLE-FLIGHT: unavailable Mongo denied, simultaneous recovery shared one readiness and route mount, repeat idempotent");
