import assert from "node:assert/strict";
import { createMovieMentorProjectOwnership } from "../ai/MovieMentorProjectOwnershipRegistry.js";
console.log("Movie Mentor project ownership create return binding authority court");
const requested={projectId:"project-A",ownerPrincipalId:"principal-A",ownershipReference:"movie-mentor-project-ownership:project-A:authority-A",establishmentAuthorityId:"authority-A",establishmentSource:"native-project-creation",establishedAt:"2035-01-01T00:00:00.000Z"};
const wrong={domain:"iband.movie-mentor.project-ownership",schema:1,projectId:"project-OTHER",ownerPrincipalId:"principal-OTHER",ownershipRevision:1,ownershipReference:"movie-mentor-project-ownership:project-OTHER:authority-OTHER",establishmentAuthorityId:"authority-OTHER",establishmentSource:"native-project-creation",status:"active",establishedAt:"2035-01-01T00:00:00.000Z",updatedAt:"2035-01-01T00:00:00.000Z"};
const mongoModel={async create(){return structuredClone(wrong)}};
let failure=null;
try{await createMovieMentorProjectOwnership(requested,{mongoModel,ensureConnectionFn:async()=>true,ensurePhysicalUniqueIndexReadinessFn:async()=>({ready:true})})}catch(error){failure=error}
assert.ok(failure,"ownership mint must reject Mongo create evidence from a different project/owner/authority universe");
assert.equal(failure.code,"MOVIE_MENTOR_PROJECT_OWNERSHIP_CREATE_RETURN_BINDING_INVALID");
console.log("GREEN: ownership mint return binds exact requested project/owner/authority universe.");
