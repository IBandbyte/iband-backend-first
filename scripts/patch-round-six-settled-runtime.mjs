import fs from 'node:fs';
const p='ai/MovieMentorTurnRuntime.js';let s=fs.readFileSync(p,'utf8');
function all(a,b,label){const n=s.split(a).length-1;if(!n)throw new Error(`${label}: anchor missing`);s=s.split(a).join(b);console.log(label,n);}
all('const MOVIE_MENTOR_TURN_RUNTIME_VERSION = "2.4.0";','const MOVIE_MENTOR_TURN_RUNTIME_VERSION = "2.5.0";','version');
all('["closed", "finalized"].includes(s(existing?.phase))','["closed", "finalized", "settled"].includes(s(existing?.phase))','terminal replay');
all('["closing", "closed", "finalized"].includes(s(existing?.phase))','["closing", "closed", "finalized", "settled"].includes(s(existing?.phase))','staged recovery');
all('settlement?.outcome !== "consumed")','settlement?.outcome !== "consumed" || settlement?.executionPhase !== "settled")','settled proof');
all('settlement: "consumed",','settlement: "consumed",\n        settlementExecutionPhase: settlement?.executionPhase || null,','response proof');
fs.writeFileSync(p,s);
