import assert from "node:assert/strict";
import {createMovieMentorInferenceSpendMongoStore} from "../ai/MovieMentorInferenceSpendMongoStore.js";

let indexCalls=0;
let physicalIndexReads=0;
let transactionCalls=0;
let indexesReady=false;

function query(result=null){return{session(){return this;},lean(){return this;},exec:async()=>result};}
const entitlementIndexes=Object.freeze([{name:"principalId_1",key:Object.freeze({principalId:1}),unique:true}]);
const reservationIndexes=Object.freeze([{name:"reservationId_1",key:Object.freeze({reservationId:1}),unique:true}]);
const entitlementModel={
 async createIndexes(){indexCalls+=1;},
 collection:{async indexes(){physicalIndexReads+=1;return indexesReady?entitlementIndexes:[];}},
 findOneAndUpdate(){return query(null);}
};
const reservationModel={
 async createIndexes(){indexCalls+=1;indexesReady=true;},
 collection:{async indexes(){physicalIndexReads+=1;return indexesReady?reservationIndexes:[];}},
 findOne(){return query(null);},
 async create(){if(!indexesReady){const error=new Error("physical unique indexes were not ready before inference spend reservation mutation");error.code="INDEX_NOT_READY";throw error;}return[];}
};
const session={
 async withTransaction(fn){transactionCalls+=1;await fn();},
 async endSession(){}
};
const store=createMovieMentorInferenceSpendMongoStore({models:{entitlementModel,reservationModel},startSession:async()=>session});

const result=await store.reserve({reservationId:"reservation-index-readiness",principalId:"principal-1",projectId:"project-1",operation:"story.generate",units:1});
assert.equal(result.granted,false,"court only needs to cross readiness before transaction decision");
assert.equal(indexCalls,2,"both entitlement and reservation physical indexes must be initialized before inference spend transaction authority");
assert.equal(physicalIndexReads,2,"inference spend must inspect both owned collection index catalogues after initialization");
assert.equal(transactionCalls,1,"transaction may begin only after exact observed physical index readiness is proven");
const status=store.getStatus?.() ?? null;
assert.equal(status?.uniquenessReadinessRequired,true,"store must advertise uniqueness-readiness requirement");
assert.equal(status?.physicalUniqueIndexReadiness,true,"store must advertise physical unique-index readiness");
assert.equal(status?.physicalUniqueIndexObservationRequired,true,"store must distinguish model initialization from observed Mongo physical authority");

console.log("inference spend index-readiness torture: GREEN");
console.log("LAW: INITIALIZATION PREPARES INFERENCE-SPEND INDEXES; EACH OWNED COLLECTION MUST THEN PROVE ITS OWN OBSERVED PHYSICAL UNIQUE IDENTITY BEFORE TRANSACTION AUTHORITY MAY CROSS.");
