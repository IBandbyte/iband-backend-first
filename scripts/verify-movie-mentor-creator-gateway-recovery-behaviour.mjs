import assert from "node:assert/strict";
import {registerMovieMentorCreatorGatewayRecovery} from "../ai/MovieMentorCreatorGatewayRecovery.js";

// Deterministic scheduler, no timers, HTTP server, database or external network.
function court({initialMount={mounted:false},prepare=async()=>({ready:true}),mount=async()=>({mounted:true}),maxAttempts=3}={}){
 const scheduled=new Map();let id=0;let mountCalls=0;let prepareCalls=0;
 const coordinator=registerMovieMentorCreatorGatewayRecovery({
  initialMount,maxAttempts,delayMs:1,
  prepare:async()=>{prepareCalls++;return prepare();},
  mount:async()=>{mountCalls++;return mount();},
  schedule:fn=>{const key=++id;scheduled.set(key,fn);return key;},
  cancel:key=>scheduled.delete(key)
 });
 return {coordinator,scheduled,get mountCalls(){return mountCalls;},get prepareCalls(){return prepareCalls;},
  async tick(){assert.equal(scheduled.size,1,"Exactly one retry may be scheduled.");const [key,fn]=scheduled.entries().next().value;scheduled.delete(key);fn();await new Promise(resolve=>setImmediate(resolve));}
 };
}
const already=court({initialMount:{mounted:true}});
assert.equal(already.scheduled.size,0,"Already-mounted gateway must not schedule retry.");
assert.equal(already.coordinator.getStatus().mounted,true);
const success=court();
assert.equal(success.scheduled.size,1);
await success.tick();
assert.equal(success.mountCalls,1);
assert.equal(success.coordinator.getStatus().mounted,true);
assert.equal(success.scheduled.size,0,"Successful mount must stop retry scheduling.");
const missing=court({prepare:async()=>({ready:false,reason:"db-unavailable"}),maxAttempts:2});
await missing.tick();assert.equal(missing.mountCalls,0);assert.equal(missing.scheduled.size,1);
await missing.tick();assert.equal(missing.mountCalls,0);assert.equal(missing.scheduled.size,0);
assert.equal(missing.coordinator.getStatus().exhausted,true);
const denied=court({mount:async()=>({mounted:false,reason:"strict-gate-denied"}),maxAttempts:2});
await denied.tick();await denied.tick();
assert.equal(denied.mountCalls,2);assert.equal(denied.scheduled.size,0);
const cancelled=court();
cancelled.coordinator.stop();assert.equal(cancelled.scheduled.size,0);
assert.equal(cancelled.coordinator.getStatus().stopped,true);
let resolvePreparation;
const pending=court({prepare:()=>new Promise(resolve=>{resolvePreparation=resolve;})});
const [key,fn]=pending.scheduled.entries().next().value;
pending.scheduled.delete(key);fn();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(pending.coordinator.getStatus().running,true);
assert.equal(pending.scheduled.size,0,"In-flight preparation must not overlap scheduled retry.");
pending.coordinator.stop();resolvePreparation({ready:true});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(pending.mountCalls,0,"Stopped recovery must never mount after in-flight preparation.");
assert.equal(pending.scheduled.size,0);
console.log("GREEN: initial mounted, successful stop, missing Mongo, strict denial, bounded exhaustion, cancellation and in-flight stop.");
