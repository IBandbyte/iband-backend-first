import assert from "node:assert/strict";
import {registerMovieMentorCreatorGatewayRecovery} from "../ai/MovieMentorCreatorGatewayRecovery.js";

// RED-first: operational logging/observer failures must not crash the
// unawaited timer callback or prevent bounded recovery. No network or DB.
const tasks=new Map();let sequence=0;
const recovery=registerMovieMentorCreatorGatewayRecovery({
 initialMount:{mounted:false},
 prepare:async()=>({ready:true}),
 mount:async()=>({mounted:false,reason:"strict-atomic-not-ready"}),
 onResult:()=>{throw new Error("simulated logging failure");},
 maxAttempts:2,delayMs:1,
 schedule:fn=>{const id=++sequence;tasks.set(id,fn);return id;},
 cancel:id=>tasks.delete(id)
});
async function tick(){
 assert.equal(tasks.size,1,"One scheduled retry expected.");
 const [id,callback]=tasks.entries().next().value;
 tasks.delete(id);
 callback();
 await new Promise(resolve=>setImmediate(resolve));
}
try{
 await tick();
 assert.equal(recovery.getStatus().attempts,1);
 assert.equal(tasks.size,1,"Observer failure must not prevent second bounded retry.");
 await tick();
 assert.equal(recovery.getStatus().attempts,2);
 assert.equal(recovery.getStatus().exhausted,true);
 assert.equal(tasks.size,0);
 console.log("GREEN: observer/logging failure cannot cause unhandled rejection or interrupt bounded recovery.");
}finally{recovery.stop();}
