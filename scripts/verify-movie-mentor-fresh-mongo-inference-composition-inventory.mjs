import assert from "node:assert/strict";
import {createMovieMentorProductionInferenceSpendComposition} from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import {createMovieMentorProductionInferenceExecutionComposition} from "../ai/MovieMentorProductionInferenceExecutionComposition.js";
import {createMovieMentorProductionInferenceSettlementComposition} from "../ai/MovieMentorProductionInferenceSettlementComposition.js";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//);
process.env.MONGO_URI=uri;
const spend=createMovieMentorProductionInferenceSpendComposition();
const execution=createMovieMentorProductionInferenceExecutionComposition();
const settlement=createMovieMentorProductionInferenceSettlementComposition();
for(const [name,composition] of [["spend",spend],["execution",execution],["settlement",settlement]]){
 assert.equal(typeof composition.ready,"boolean",name+" composition must report readiness");
 assert.equal(typeof composition.reason,"string",name+" composition must report its reason");
 assert.equal(typeof composition.getStatus,"function",name+" composition must expose status");
 if(composition.ready)assert.ok(composition.getStatus(),name+" ready composition must expose authority status");
 console.log(name+": "+(composition.ready?"READY":"CLOSED")+" ("+composition.reason+")");
}
assert.equal([spend,execution,settlement].length,3);
console.log("GREEN CHARACTERIZATION ONLY: all composition factories were invoked against disposable Mongo configuration; ready flags are factory-level reports, not independently verified physical indexes, route mount, or provider execution.");
