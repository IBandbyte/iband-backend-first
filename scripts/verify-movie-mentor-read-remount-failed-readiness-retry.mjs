import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source=readFileSync(new URL("../server.js",import.meta.url),"utf8");
const start=source.indexOf("let movieMentorReadOnlyRecoveryIngressMounted=false;");
const end=source.indexOf("await mountMovieMentorNativeProjectCreationIngress();",start);
assert.ok(start>=0&&end>start,"RED: server mount source unavailable");
const mongo={connection:{readyState:1}};
const registered=[];
let readinessCalls=0;
let denyReadiness=true;
const authentication={ready:true,getStatus:()=>({ready:true})};
const ownership={getStatus:()=>({ready:true})};
const context={
  mongoose:mongo,app:{use:(path,router)=>registered.push({path,router})},
  console:{log:()=>{}},
  createMovieMentorProductionAuthenticationComposition:()=>authentication,
  authenticationCompositionProven:()=>true,
  movieMentorProjectOwnershipAuthority:ownership,ownershipAuthorityProven:()=>true,
  createMovieMentorCreatorStateAtomicCompositionFromMongoose:()=>({atomicCreatorStateReadiness:{}}),
  assertMovieMentorCreatorGatewayAtomicMountReadiness:async()=>{
    readinessCalls++;
    if(denyReadiness)throw new Error("injected-readiness-denial");
  },
  createMovieMentorCreatorStateRecoveryProductionComposition:()=>({}),
  createMovieMentorCreatorStateReadExpressRouter:()=>({readOnly:true}),
  readAuthoritativeTurnSource:async()=>null,
};
runInNewContext(source.slice(start,end)+"\nthis.mount=mountMovieMentorReadOnlyRecoveryIngress;",context);
const mount=context.mount;
const first=mount();
const second=mount();
assert.equal(first,second,"RED: simultaneous failed-readiness callers must share one in-flight attempt");
const [one,two]=await Promise.all([first,second]);
assert.equal(one.mounted,false,"RED: failed readiness must not claim mounted");
assert.equal(two.mounted,false,"RED: failed readiness must deny all waiting callers");
assert.equal(registered.length,0,"RED: failed readiness must not register routes");
assert.equal(readinessCalls,1,"RED: failed readiness must be attempted once for concurrent callers");
denyReadiness=false;
const recovered=await mount();
assert.equal(recovered.mounted,true,"RED: later healthy readiness must retry successfully");
assert.equal(readinessCalls,2,"RED: failed single-flight must release for subsequent retry");
assert.equal(registered.length,1,"RED: recovered readiness must mount exactly one router");
await mount();
assert.equal(registered.length,1,"RED: successful mount must remain idempotent");
console.log("GREEN RUNTIME RETRY: concurrent failed readiness denied without mount; later healthy retry mounted once and remained idempotent");
