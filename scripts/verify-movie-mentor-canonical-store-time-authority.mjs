import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorCanonicalResultMongoStore} from "../ai/MovieMentorCanonicalResultMongoStore.js";

const base={resultReference:"result-time",candidateReference:"candidate-time",executionId:"execution-time",creatorTurnId:"turn-time",principalId:"creator-time",projectId:"project-time",reservationId:"reservation-time",requestDigest:"request-time",closureReference:"closure-time",closureCertificateDigest:"certificate-time",resultDigest:"digest-time",resultPayload:{text:"durable"},committedAt:null};
let created=0;
const model={
  create:async row=>{created+=1;return row;},
  findOne(){return{lean(){return{exec:async()=>null}}}}
};
const store=createMovieMentorCanonicalResultMongoStore({mongoModel:model,executionCollection:false});
await assert.rejects(()=>store.commit(base),e=>e.code==="MOVIE_MENTOR_CANONICAL_RESULT_TIME_INVALID");
assert.equal(created,0,"canonical store must reject absent time before persistence");
await assert.rejects(()=>store.commit({...base,committedAt:"not-a-date"}),e=>e.code==="MOVIE_MENTOR_CANONICAL_RESULT_TIME_INVALID");
assert.equal(created,0,"canonical store must reject malformed time before persistence");

const source=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultMongoStore.js",import.meta.url),"utf8");
assert.match(source,/function instant\(v\)/);
assert.match(source,/MOVIE_MENTOR_CANONICAL_RESULT_TIME_INVALID/);
assert.match(source,/committedAt:instant\(record\.committedAt\)/);
assert.doesNotMatch(source,/committedAt:new Date\(record\.committedAt\)/);

console.log("5A.24 canonical-result store proof-time catastrophe gate: GREEN");
console.log("✓ direct store callers cannot convert absent committedAt into Unix epoch history");
console.log("✓ malformed committedAt fails before persistence");
console.log("LAW: AN AUTHORITY-SIDE CLOCK CHECK DOES NOT EXCUSE THE DURABLE STORE FROM DEFENDING ITS OWN PROOF BOUNDARY.");
