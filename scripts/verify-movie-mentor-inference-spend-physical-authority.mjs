import assert from "node:assert/strict";
import {createMovieMentorInferenceSpendMongoStore} from "../ai/MovieMentorInferenceSpendMongoStore.js";
let transactions=0,writes=0;
function query(value=null){return{session(){return this;},lean(){return this;},async exec(){return value;}};}
const wrong=[{name:"_id_",key:{_id:1},unique:true}];
const entitlementModel={async createIndexes(){return[];},collection:{async indexes(){return wrong;}},findOne(){return query(null);},findOneAndUpdate(){writes+=1;return query(null);}};
const reservationModel={async createIndexes(){return[];},collection:{async indexes(){return wrong;}},findOne(){return query(null);},async create(rows){writes+=1;return rows;}};
const session={async withTransaction(fn){transactions+=1;await fn();},async endSession(){}};
const store=createMovieMentorInferenceSpendMongoStore({models:{entitlementModel,reservationModel},connect:async()=>{},startSession:async()=>session});
await assert.rejects(
 ()=>store.reserve({reservationId:"reservation-physical-red",principalId:"creator-physical-red",projectId:"project-physical-red",operation:"mentor-turn",units:1}),
 error=>error?.code==="MOVIE_MENTOR_INFERENCE_SPEND_PHYSICAL_AUTHORITY_UNAVAILABLE",
 "index initialization must not lend spend authority when exact physical unique identities are absent",
);
assert.equal(transactions,0,"missing physical uniqueness must fail before spend transaction authority");
assert.equal(writes,0,"missing physical uniqueness must fail before entitlement or reservation mutation");
console.log("GREEN: inference spend independently observes exact physical unique identities before reservation authority.");
