import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProjectOwnershipAuthority} from "../ai/MovieMentorProjectOwnershipRegistry.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_ownership_index_candidate_court");
await mongoose.connect(process.env.MONGO_URI);
try {
 const authority=createMovieMentorProjectOwnershipAuthority();
 await authority.authorizeProject({principal:{authenticated:true,principalId:"owner-A"},projectId:"not-yet-created"}).catch(()=>{});
 const original=mongoose.models.MovieMentorProjectOwnership;
 assert.ok(original,"production ownership model must be instantiated");
 const schema=original.schema.clone();
 const path=schema.path("projectId");
 assert.equal(Boolean(path.options.index),true);
 delete path.options.index;
 path._index=null;
 const definitions=schema.indexes().filter(([key])=>Object.keys(key).length===1&&key.projectId===1);
 assert.equal(definitions.length,1,"candidate must preserve exactly one project index");
 assert.equal(definitions[0][1].unique,true,"candidate project index must remain unique");
 const Candidate=mongoose.model("MovieMentorOwnershipIndexCandidateAudit",schema);
 await Candidate.createIndexes();
 const physical=await Candidate.collection.indexes();
 assert.ok(physical.some(i=>i.key?.projectId===1&&i.unique===true));
 assert.ok(physical.some(i=>i.key?.establishmentAuthorityId===1&&i.unique===true));
 const base={domain:"iband.movie-mentor.project-ownership",schema:1,projectId:"candidate-project",ownerPrincipalId:"owner-A",ownershipRevision:1,ownershipReference:"owner-ref-A",establishmentAuthorityId:"candidate-establish-A",establishmentSource:"native-project-creation",status:"active",establishedAt:new Date()};
 await Candidate.create(base);
 let competitor;try{await Candidate.create({...base,ownerPrincipalId:"owner-B",ownershipReference:"owner-ref-B",establishmentAuthorityId:"candidate-establish-B"});}catch(e){competitor=e;}
 assert.equal(competitor?.code,11000);
 let replay;try{await Candidate.create({...base,projectId:"other-project"});}catch(e){replay=e;}
 assert.equal(replay?.code,11000);
 assert.equal(await Candidate.countDocuments({}),1);
 const persisted=await Candidate.findOne({projectId:"candidate-project"}).lean();
 assert.equal(persisted.ownerPrincipalId,"owner-A");
 console.log(JSON.stringify({court:"ownership-index-minimal-schema-candidate-physical",classification:"audit-only cloned production Mongoose schema with field-level projectId index removed; direct model writes, NOT real ownership authority API or production repair",projectUnique:true,establishmentUnique:true,competingOwnerCode:competitor.code,replayAuthorityCode:replay.code,rows:1,owner:persisted.ownerPrincipalId}));
 console.log("PASS: cloned candidate creates both unique indexes and physically rejects competing ownership and establishment replay");
}finally{await mongoose.disconnect();}
