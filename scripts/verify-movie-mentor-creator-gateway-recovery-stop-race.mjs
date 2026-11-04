import assert from "node:assert/strict";
import {registerMovieMentorCreatorGatewayRecovery} from "../ai/MovieMentorCreatorGatewayRecovery.js";

// RED-first: stop() during an already-started mount must not claim that
// in-flight mounting was cancelled. The coordinator cannot undo app.use().
let resolveMount;let enteredMount=false;
const timers=new Map();let id=0;
const recovery=registerMovieMentorCreatorGatewayRecovery({
 initialMount:{mounted:false},maxAttempts:2,delayMs:1,
 schedule:fn=>{const key=++id;timers.set(key,fn);return key;},
 cancel:key=>timers.delete(key),
 prepare:async()=>({ready:true}),
 mount:async()=>{enteredMount=true;return new Promise(resolve=>{resolveMount=resolve;});}
});
const [key,fn]=timers.entries().next().value;timers.delete(key);fn();
for(let n=0;n<10&&!enteredMount;n++)await new Promise(resolve=>setImmediate(resolve));
assert.equal(enteredMount,true);
recovery.stop();
resolveMount({mounted:true,reason:"late-success"});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(recovery.getStatus().mounted,true,
 "Stop during in-flight mount must still report actual late successful mount; cannot pretend route was never attached.");
assert.equal(timers.size,0);
console.log("GREEN: late mount outcome is truthfully recorded after stop, with no subsequent retry.");
