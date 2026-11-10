import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source=readFileSync(new URL("../server.js",import.meta.url),"utf8");
const begin=source.indexOf("let movieMentorReadOnlyRecoveryIngressMounted=false;");
const finish=source.indexOf("await mountMovieMentorNativeProjectCreationIngress();",begin);
const startupBegin=source.indexOf("const initialCreatorGatewayMount=");
const startupEnd=source.indexOf("const recoveryMount=",startupBegin);
assert.ok(begin>=0&&finish>begin&&startupBegin>=0&&startupEnd>startupBegin);
const section=source.slice(begin,finish);
const startup=source.slice(startupBegin,startupEnd);
const mongo={connection:{readyState:0}};
const registered=[];
let recoveryCallback;
let readinessCalls=0;
const authentication={ready:true,getStatus:()=>({ready:true})};
const ownership={getStatus:()=>({ready:true})};
const ctx={
  mongoose:mongo,app:{use:(path,router)=>registered.push({path,router})},
  console:{log:()=>{}},
  createMovieMentorProductionAuthenticationComposition:()=>authentication,
  authenticationCompositionProven:()=>true,
  movieMentorProjectOwnershipAuthority:ownership,ownershipAuthorityProven:()=>true,
  createMovieMentorCreatorStateAtomicCompositionFromMongoose:()=>({atomicCreatorStateReadiness:{}}),
  assertMovieMentorCreatorGatewayAtomicMountReadiness:async()=>{readinessCalls++;},
  createMovieMentorCreatorStateRecoveryProductionComposition:()=>({}),
  createMovieMentorCreatorStateReadExpressRouter:()=>({readOnly:true}),
  readAuthoritativeTurnSource:async()=>null,
  mountMovieMentorCreatorGateway:async()=>({mounted:false,reason:"mongo-unavailable"}),
  registerMovieMentorCreatorGatewayRecovery:({onResult})=>{recoveryCallback=onResult;},
  prepareMovieMentorCreatorMongoConnection:async()=>({ready:false}),
};
runInNewContext(section+"\nthis.mountRead=mountMovieMentorReadOnlyRecoveryIngress;",ctx);
const startupScript=startup.replace("const initialCreatorGatewayMount=","this.initialCreatorGatewayMount=").replace("const creatorMongoStartup=","this.creatorMongoStartup=");
await runInNewContext("(async()=>{"+startupScript+"})()",ctx);
assert.equal(registered.length,0,"RED: startup Mongo failure must not expose read routes");
assert.equal(typeof recoveryCallback,"function","RED: recovery callback must be registered");
mongo.connection.readyState=1;
await recoveryCallback({mounted:false,reason:"gateway-not-ready",attempts:1});
assert.equal(registered.length,0,"RED: failed gateway recovery must not expose read-only routes even when Mongo is connected");
assert.equal(readinessCalls,0,"RED: failed gateway recovery must not start read-only mount readiness");
await Promise.all([
  recoveryCallback({mounted:true,reason:"recovered",attempts:1}),
  recoveryCallback({mounted:true,reason:"recovered",attempts:2}),
]);
assert.equal(registered.length,1,"RED: concurrent successful gateway recovery must register one read-only router");
assert.equal(readinessCalls,1,"RED: gateway recovery callbacks must share single-flight readiness");
await recoveryCallback({mounted:true,reason:"recovered",attempts:3});
assert.equal(registered.length,1,"RED: later gateway callback must not duplicate read-only routes");
console.log("GREEN RUNTIME CALLBACK: failed startup, denied failed-gateway notification, simultaneous successful gateway callbacks, exactly one read-only mount");
