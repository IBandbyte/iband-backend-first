import fs from "node:fs";
const p="ai/MovieMentorInferenceExecutionMongoStore.js";let s=fs.readFileSync(p,"utf8");
const a='![2,3,4,SCHEMA].includes(v.schema)';const b='![2,3,4,5,SCHEMA].includes(v.schema)';const n=s.split(a).length-1;if(n!==1)throw new Error(`schema compatibility anchor expected 1, found ${n}`);s=s.replace(a,b);fs.writeFileSync(p,s);console.log("schema5 compatibility restored");
