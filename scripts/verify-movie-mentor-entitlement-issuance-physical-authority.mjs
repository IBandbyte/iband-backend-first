import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorEntitlementIssuanceMongoStore} from "../ai/MovieMentorEntitlementIssuanceMongoStore.js";

const source=fs.readFileSync(new URL("../ai/MovieMentorEntitlementIssuanceMongoStore.js",import.meta.url),"utf8");
assert.match(source,/es\.index\(\{principalId:1\},\{unique:true\}\)/);
assert.match(source,/is\.index\(\{issuanceId:1\},\{unique:true\}\)/);
assert.match(source,/is\.index\(\{evidenceSource:1,evidenceId:1\},\{unique:true\}\)/);
assert.match(source,/E\.create/);
assert.match(source,/I\.create/);

let transactions=0, writes=0;
function query(value=null){return{session(){return this;},lean(){return this;},async exec(){return value;}};}
const wrong=[{name:"_id_",key:{_id:1},unique:true}];
const entitlementModel={
 async createIndexes(){return[];},
 collection:{async indexes(){return wrong;}},
 findOne(){return query(null);},
 async create(rows){writes+=1;return rows;},
};
const issuanceModel={
 async createIndexes(){return[];},
 collection:{async indexes(){return wrong;}},
 findOne(){return query(null);},
 async create(rows){writes+=1;return rows;},
};
const session={
 async withTransaction(fn){transactions+=1;await fn();},
 async endSession(){},
};
const store=createMovieMentorEntitlementIssuanceMongoStore({
 modelSet:{entitlementModel,issuanceModel},
 connectStore:async()=>{},
 startSession:async()=>session,
 createIssuanceId:()=>"issuance-physical-red",
 now:()=>new Date("2035-01-01T00:00:00.000Z"),
});
await assert.rejects(
 ()=>store.issue({evidenceId:"evt-physical-red",evidenceSource:"stripe",evidenceKind:"payment",evidenceDigest:"digest-physical-red",principalId:"creator-physical-red",units:20,commercialReference:"payment-physical-red"}),
 e=>e?.code==="MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_PHYSICAL_AUTHORITY_UNAVAILABLE",
 "createIndexes success must not lend entitlement/issuance authority when exact physical unique indexes are absent",
);
assert.equal(transactions,0,"missing physical uniqueness must fail before transaction authority");
assert.equal(writes,0,"missing physical uniqueness must fail before durable entitlement or receipt mutation");
console.log("GREEN: entitlement issuance independently observes all required physical unique identities before transaction authority.");
