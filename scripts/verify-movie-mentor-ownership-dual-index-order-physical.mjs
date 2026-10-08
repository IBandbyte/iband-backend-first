import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProjectOwnershipAuthority} from "../ai/MovieMentorProjectOwnershipRegistry.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_ownership_index_dual_order_court");
await mongoose.connect(process.env.MONGO_URI);
try{
 const authority=createMovieMentorProjectOwnershipAuthority();
 const projectId="index-order-project",principal={authenticated:true,principalId:"owner-A"};
 const proof={verified:true,type:"native-project-creation",authorityId:"native-index-order",projectId,principalId:"owner-A"};
 let error;try{await authority.establishNativeOwnership({principal,projectId,establishmentAuthority:proof});}catch(e){error=e;}
 assert.equal(error?.code,86);
 const model=mongoose.models.MovieMentorProjectOwnership;
 assert.ok(model);
 const projectIndexes=model.schema.indexes().filter(([keys])=>keys.projectId===1&&Object.keys(keys).length===1);
 assert.equal(projectIndexes.length,2);
 assert.deepEqual(projectIndexes.map(([,opts])=>opts.unique===true).sort(),[false,true]);
 const collection=mongoose.connection.collection("movie_mentor_project_ownership");
 const original=await collection.indexes();
 assert.ok(original.some(i=>i.name==="projectId_1"&&i.unique!==true));
 await collection.dropIndex("projectId_1");
 await collection.createIndex({projectId:1},{unique:true,name:"projectId_1"});
 let reverse;try{await authority.establishNativeOwnership({principal,projectId,establishmentAuthority:proof});}catch(e){reverse=e;}
 assert.equal(reverse?.code,86);
 assert.equal(await collection.countDocuments({projectId}),0);
 console.log(JSON.stringify({court:"ownership-dual-index-order-physical-characterization",classification:"isolated physical schema collision both index orders; NO production mutation; ownership API assertions remain blocked",modelProjectIdIndexDefinitions:projectIndexes.map(([,opts])=>({unique:opts.unique===true})),freshNonUniqueFirstError:error.code,preprovisionedUniqueFirstError:reverse.code,ownershipRowsCreated:0}));
 console.log("PASS: both non-unique-first and unique-first physical index states collide under unchanged production schema");
}finally{await mongoose.disconnect();}
