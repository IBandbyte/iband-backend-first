import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProjectOwnershipAuthority} from "../ai/MovieMentorProjectOwnershipRegistry.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_ownership_index_collision_court");
await mongoose.connect(process.env.MONGO_URI);
const col=mongoose.connection.collection("movie_mentor_project_ownership");
const authority=createMovieMentorProjectOwnershipAuthority();
const principal={authenticated:true,principalId:"owner-A"};
const projectId="index-collision-project";
const establishmentAuthority={verified:true,type:"native-project-creation",authorityId:"native-index-court",projectId,principalId:"owner-A"};
let firstError;
try{await authority.establishNativeOwnership({principal,projectId,establishmentAuthority});}catch(e){firstError=e;}
assert.equal(firstError?.code,86,"Fresh registry must expose the real conflicting index specification");
const indexesBefore=await col.indexes();
assert.ok(indexesBefore.some(i=>i.name==="projectId_1"&&i.unique!==true));
assert.equal(await col.countDocuments({}),0);
await col.dropIndex("projectId_1");
await col.createIndex({projectId:1},{unique:true,name:"projectId_1"});
const indexesAfter=await col.indexes();
assert.ok(indexesAfter.some(i=>i.name==="projectId_1"&&i.unique===true));
let afterError;let created;
try{created=await authority.establishNativeOwnership({principal,projectId,establishmentAuthority});}catch(e){afterError=e;}
assert.equal(afterError,undefined);
assert.equal(created.status,"established");
const authorized=await authority.authorizeProject({principal,projectId});
assert.equal(authorized.authorized,true);
let competingError;
try{await authority.establishNativeOwnership({principal:{authenticated:true,principalId:"owner-B"},projectId,establishmentAuthority:{verified:true,type:"native-project-creation",authorityId:"native-index-other",projectId,principalId:"owner-B"}});}catch(e){competingError=e;}
assert.equal(competingError?.code,"MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED");
console.log(JSON.stringify({court:"ownership-index-collision-fresh-versus-preprovisioned",classification:"audit-only isolated MongoDB index repair fixture; NO production index mutation; no ownership transfer/revocation proof beyond supported API",freshIndexError:firstError.code,nonUniqueIndexInitiallyPresent:true,isolatedIndexReprovisioned:true,establishment:created.status,ownerAuthorized:authorized.authorized,competingOwner:competingError.code}));
console.log("PASS: fresh registry index collision reproduced; correctly preprovisioned unique index permits supported owner authority");
await mongoose.disconnect();
