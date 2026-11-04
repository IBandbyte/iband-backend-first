import assert from "node:assert/strict";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// RED-first: operation-key uniqueness does not prove that creator-state CAS
// is physically unique. A transaction alone cannot replace a missing project index.
const operations={indexes:async()=>[{key:{projectId:1,principalId:1,operationId:1},unique:true}],findOne(){},insertOne(){}};
const states={indexes:async()=>[{key:{projectId:1},unique:false}],findOne(){},replaceOne(){}};
let sessions=0;
const client={startSession(){sessions++;throw new Error("Physical index preflight should prevent session creation");}};
const accept=createMongoCreatorStateAtomicAccept({client,states,operations});
await assert.rejects(
 ()=>accept({envelope:{projectId:"p",principalId:"owner",operationId:"op",source:"creator-memory",expectedRevision:0,requestDigest:"hash"},proposedState:{projectId:"p",revision:1,creatorStateGeneration:1,creatorStateFingerprint:"test-fingerprint"},creatorStateMutationAuthority:{domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:"owner",projectId:"p",assertCurrentMutation:async target=>({domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:true,currentOwnershipVerified:true,principalId:"owner",projectId:"p",ownershipRef:"isolated-proof",ownershipRevision:1,...target})}}),
 error=>error.code==="MOVIE_MENTOR_CREATOR_STATE_PROJECT_INDEX_REQUIRED",
 "RED: missing unique project index must reject before a Mongo transaction begins."
);
assert.equal(sessions,0);
console.log("GREEN: transactional adapter refuses absent physical unique project index before session.");

const {assertProjectIndex}=await import("../ai/MovieMentorCreatorStateMongoOperationAdapter.js");
const productionIndex={key:{projectId:1},unique:true,partialFilterExpression:{projectId:{$type:"string"}}};
await assertProjectIndex({indexes:async()=>[productionIndex]});
await assert.rejects(()=>assertProjectIndex({indexes:async()=>[{...productionIndex,partialFilterExpression:{projectId:{$exists:true}}}]}),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_PROJECT_INDEX_REQUIRED","Wrong partial predicate must not authorize project uniqueness.");
await assert.rejects(()=>assertProjectIndex({indexes:async()=>[{...productionIndex,unique:false}]}),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_PROJECT_INDEX_REQUIRED","Nonunique project index must not authorize CAS.");
console.log("GREEN: exact production partial unique project index accepted; weaker variants denied.");
