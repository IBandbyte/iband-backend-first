import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorInferenceSpendMongoStore} from "../ai/MovieMentorInferenceSpendMongoStore.js";

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceSpendComposition.js",import.meta.url),"utf8");
const serverSource=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");

assert.match(serverSource,/createMovieMentorProductionInferenceSpendComposition\(\)/,"production creator gateway must instantiate the production inference-spend composition");
assert.match(serverSource,/createMovieMentorTurnRouter\(\{requestAuthority,inferenceSpendAuthority:spendComposition\.authority/,"production Movie Mentor router must receive the owner-proven spend authority");
assert.match(compositionSource,/store\|\|createMovieMentorInferenceSpendMongoStore\(\)/,"production inference-spend composition must instantiate the durable Mongo store by default");
assert.match(storeSource,/entitlementSchema\.index\(\{principalId:1\},\{unique:true\}\)/,"inference spend depends on unique current-entitlement principal identity");
assert.match(storeSource,/reservationSchema\.index\(\{reservationId:1\},\{unique:true\}\)/,"inference spend reservation identity must be declared unique");
assert.match(storeSource,/Reservation\.create\(/,"reservation grant must cross a durable reservation mint");
assert.match(storeSource,/withTransaction/ ,"reservation authority must cross the transaction boundary");

let indexInitializations=0;
let durableReads=0;
let durableWrites=0;
let transactions=0;
const wrongPhysicalIndexes=Object.freeze([{name:"_id_",key:Object.freeze({_id:1}),unique:true}]);
function q(value){return{session(){return this;},lean(){return this;},async exec(){durableReads+=1;return value;}};}
const entitlementModel={
 async createIndexes(){indexInitializations+=1;return[];},
 collection:{async indexes(){return wrongPhysicalIndexes;}},
 findOneAndUpdate(){durableWrites+=1;return q(null);},
};
const reservationModel={
 async createIndexes(){indexInitializations+=1;return[];},
 collection:{async indexes(){return wrongPhysicalIndexes;}},
 findOne(){return q(null);},
 async create(){durableWrites+=1;return[];},
};
const session={async withTransaction(fn){transactions+=1;await fn();},async endSession(){}};
const store=createMovieMentorInferenceSpendMongoStore({models:{entitlementModel,reservationModel},startSession:async()=>session});

await assert.rejects(
 ()=>store.reserve({reservationId:"reservation-physical-red",principalId:"creator-physical-red",projectId:"project-physical-red",operation:"story.generate",units:1}),
 error=>error?.code==="MOVIE_MENTOR_INFERENCE_SPEND_PHYSICAL_AUTHORITY_UNAVAILABLE",
 "successful model index initialization must not lend spend authority when exact physical Mongo unique identities are absent",
);
assert.equal(indexInitializations,2,"court must let both model index initializations succeed before testing observed physical reality");
assert.equal(transactions,0,"missing physical uniqueness must fail before inference-spend transaction entry");
assert.equal(durableReads,0,"missing physical uniqueness must fail before durable reservation reads");
assert.equal(durableWrites,0,"missing physical uniqueness must fail before entitlement CAS or reservation mint");

console.log("GREEN: inference spend independently proves exact entitlement and reservation physical unique identities before reservation authority crosses transaction or durable mutation boundaries.");
console.log("LAW: MODEL INDEX INITIALIZATION IS NOT OBSERVED INFERENCE-SPEND PHYSICAL AUTHORITY; NEIGHBOUR ENTITLEMENT PROOF CANNOT BE BORROWED.");
