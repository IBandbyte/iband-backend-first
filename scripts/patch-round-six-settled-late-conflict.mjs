import fs from "node:fs";
const p="ai/MovieMentorInferenceExecutionMongoStore.js";let s=fs.readFileSync(p,"utf8");
function once(a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(`${label}: expected 1 anchor, found ${n}`);s=s.replace(a,b);}
once('const VERSION="1.7.0",DOMAIN="iband.movie-mentor.inference-execution-store",SCHEMA=5','const VERSION="1.8.0",DOMAIN="iband.movie-mentor.inference-execution-store",SCHEMA=5','version');
once('phase:{$in:["closing","closed","finalized"]},closureReference:text(closureReference)','phase:{$in:["closing","closed","finalized","settled"]},closureReference:text(closureReference)','settled quarantine');
fs.writeFileSync(p,s);console.log("settled late-conflict quarantine patch applied");
