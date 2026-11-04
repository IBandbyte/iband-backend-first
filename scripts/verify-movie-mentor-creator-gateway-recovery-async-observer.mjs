import assert from "node:assert/strict";
import {registerMovieMentorCreatorGatewayRecovery} from "../ai/MovieMentorCreatorGatewayRecovery.js";

// RED-first: asynchronous observer failures must be contained as well as
// synchronous throws. A rejected promise from onResult must not become
// an unhandled rejection in a scheduled recovery callback.
const timers=new Map();let id=0;
const recovery=registerMovieMentorCreatorGatewayRecovery({
 initialMount:{mounted:false},maxAttempts:2,delayMs:1,
 schedule:fn=>{const key=++id;timers.set(key,fn);return key;},
 cancel:key=>timers.delete(key),
 prepare:async()=>({ready:true}),
 mount:async()=>({mounted:false,reason:"strict-gateway-denied"}),
 onResult:async()=>{throw new Error("simulated async observer rejection");}
});
try{
 for(let n=1;n<=2;n++){
  assert.equal(timers.size,1,"Exactly one retry must be scheduled.");
  const [key,callback]=timers.entries().next().value;
  timers.delete(key);callback();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(recovery.getStatus().attempts,n);
 }
 assert.equal(recovery.getStatus().exhausted,true);
 assert.equal(timers.size,0);
 console.log("GREEN: async observer rejection contained; bounded recovery completes.");
}finally{recovery.stop();}
