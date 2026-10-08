import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProjectOwnershipAuthority,readMovieMentorProjectOwnership} from "../ai/MovieMentorProjectOwnershipRegistry.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_ownership_reachability_court");
await mongoose.connect(process.env.MONGO_URI);
try{
 const authority=createMovieMentorProjectOwnershipAuthority();
 const status=authority.getStatus();
 assert.equal(status.ownershipTransfer,false);
 assert.equal(status.createOnce,true);
 assert.equal(typeof authority.transferOwnership,"undefined");
 assert.equal(typeof authority.revokeOwnership,"undefined");
 const projectId="ownership-reachability-project";
 const principal={authenticated:true,principalId:"owner-A"};
 const proof={verified:true,type:"native-project-creation",authorityId:"native-authority-A",projectId,principalId:"owner-A"};
 const first=await authority.establishNativeOwnership({principal,projectId,establishmentAuthority:proof});
 assert.equal(first.status,"established");
 const before=await authority.authorizeProject({principal,projectId});
 assert.equal(before.authorized,true);
 const collection=mongoose.connection.collection("movie_mentor_project_ownership");
 const schemaModel=mongoose.models.MovieMentorProjectOwnership;
 assert.ok(schemaModel);
 assert.equal(schemaModel.schema.path("ownerPrincipalId").options.immutable,true);
 assert.equal(schemaModel.schema.path("ownershipReference").options.immutable,true);
 assert.deepEqual(schemaModel.schema.path("status").enumValues,["active"]);
 const competing={authenticated:true,principalId:"owner-B"};
 let error;try{await authority.establishNativeOwnership({principal:competing,projectId,establishmentAuthority:{verified:true,type:"native-project-creation",authorityId:"native-authority-B",projectId,principalId:"owner-B"}});}catch(e){error=e;}
 assert.equal(error?.code,"MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED");
 const after=await authority.authorizeProject({principal,projectId});
 assert.equal(after.authorized,true);
 assert.equal(after.ownershipRef,before.ownershipRef);
 assert.equal(after.ownershipRevision,before.ownershipRevision);
 const durable=await readMovieMentorProjectOwnership({projectId});
 assert.equal(durable.ownerPrincipalId,"owner-A");
 assert.equal(durable.status,"active");
 assert.equal(await collection.countDocuments({projectId}),1);
 console.log(JSON.stringify({court:"production-ownership-reachability",classification:"real production MongoDB ownership registry and authority; supported API only; cannot exclude external raw DB/admin mutation",outcomes:{createOnce:first.status,ownerAStillAuthorized:after.authorized,competingEstablishment:error.code,transferAPI:false,revocationAPI:false,ownerImmutable:true,statusEnum:["active"],ownershipRevision:after.ownershipRevision}}));
 console.log("PASS: supported production ownership authority cannot reproduce simulated postcheck revocation");
}finally{await mongoose.disconnect();}
