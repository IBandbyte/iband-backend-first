import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";
import {createMovieMentorCreatorStateMutationAuthority} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

// Physical, isolated transaction ordering court. NOT a live identity-provider test.
// This court is deliberately separate from the preserved original postcheck RED.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(uri),"Localhost isolated MongoDB URI required.");
const barrier=()=>{let entered,release;const reached=new Promise(r=>entered=r);const held=new Promise(r=>release=r);return{reached,held,entered,release};};
const project=id=>"revocation-physical-"+id;
const proposed=id=>({projectId:project(id),revision:1,creatorStateGeneration:1,creatorStateFingerprint:"fingerprint-"+id,revisionAuthorityReference:"revision-"+id,creatorAuthorityReference:"authority-"+id,snapshotReference:"snapshot-"+id,capturedAt:new Date("2026-11-07T00:00:00.000Z")});
const envelope=id=>({projectId:project(id),principalId:"owner",operationId:"op-"+id,source:"creator-memory",expectedRevision:0,requestDigest:"digest-"+id});
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db;
 const states=db.collection("isolated_credential_revocation_states");
 const operations=db.collection("isolated_credential_revocation_operations");
 const ownerships=db.collection("movie_mentor_project_ownership");
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownerships.createIndex({projectId:1},{unique:true});
 const seed=async id=>ownerships.insertOne({projectId:project(id),ownerPrincipalId:"owner",ownershipReference:"ownership-"+id,ownershipRevision:1,status:"active",creatorStateFenceEpoch:0});
 const authority=(id,credential)=>{
  const requestAuthority={authorize:async()=>{
   if(credential.revoked){const e=new Error("Credential revoked");e.code="MOVIE_MENTOR_AUTH_REVOKED";throw e;}
   return{authorized:true,principalId:"owner",projectId:project(id),ownershipRef:"ownership-"+id,ownershipRevision:1};
  }};
  return createMovieMentorCreatorStateMutationAuthority({request:{},authorization:{authorized:true,principalId:"owner",projectId:project(id),ownershipRef:"ownership-"+id,ownershipRevision:1},requestAuthority});
 };
 const counts=async id=>({states:await states.countDocuments({projectId:project(id)}),operations:await operations.countDocuments({projectId:project(id)}),ownership:await ownerships.findOne({projectId:project(id)})});
 // A: credential revoked after admission but before final fresh check.
 {
  const id="before",credential={revoked:false},gate=barrier();
  await seed(id);
  const wrapped={indexes:(...a)=>states.indexes(...a),replaceOne:(...a)=>states.replaceOne(...a),findOne:async(...a)=>{const value=await states.findOne(...a);gate.entered();await gate.held;return value;}};
  const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states:wrapped,operations,ownerships});
  const pending=accept({envelope:envelope(id),proposedState:proposed(id),creatorStateMutationAuthority:authority(id,credential)});
  await gate.reached;credential.revoked=true;gate.release();
  await assert.rejects(pending,e=>e?.code==="MOVIE_MENTOR_AUTH_REVOKED","A: revoked credential must fail final fresh authorization");
  const c=await counts(id);
  assert.equal(c.states,0,"A: no creator state committed");
  assert.equal(c.operations,0,"A: no operation committed");
  assert.equal(c.ownership.creatorStateFenceEpoch,0,"A: no ownership fence acquired");
  console.log("GREEN A: revocation before final authority check denied with zero durable effects");
 }
 // B: revocation after transactional ownership fence does not retroactively cancel an authorized write.
 {
  const id="after",credential={revoked:false},gate=barrier();
  await seed(id);
  const wrappedOwnerships={collectionName:ownerships.collectionName,updateOne:async(...a)=>{const result=await ownerships.updateOne(...a);assert.equal(result.matchedCount,1,"B: ownership fence must match");gate.entered();await gate.held;return result;}};
  const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states,operations,ownerships:wrappedOwnerships});
  const pending=accept({envelope:envelope(id),proposedState:proposed(id),creatorStateMutationAuthority:authority(id,credential)});
  await gate.reached;credential.revoked=true;gate.release();
  const outcome=await pending;
  assert.equal(outcome.kind,"accepted","B: operation already fenced may complete under proposed contract");
  const c=await counts(id);
  assert.equal(c.states,1,"B: exactly one creator state committed");
  assert.equal(c.operations,1,"B: exactly one operation record committed");
  assert.equal(c.ownership.creatorStateFenceEpoch,1,"B: exactly one ownership fence committed");
  const newAccept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states,operations,ownerships});
  await assert.rejects(newAccept({envelope:{...envelope(id),operationId:"new-operation",expectedRevision:1,requestDigest:"new-digest"},proposedState:{...proposed(id),revision:2,creatorStateGeneration:2},creatorStateMutationAuthority:authority(id,credential)}),e=>e?.code==="MOVIE_MENTOR_AUTH_REVOKED","B: new operation with revoked credential must fail");
  console.log("GREEN B: post-fence revocation allowed preceding authorized commit; new operation denied");
 }
 // C: durable ownership revision change before fence rejects stale ownership.
 {
  const id="durable",credential={revoked:false},gate=barrier();
  await seed(id);
  const wrapped={indexes:(...a)=>states.indexes(...a),replaceOne:(...a)=>states.replaceOne(...a),findOne:async(...a)=>{const value=await states.findOne(...a);gate.entered();await gate.held;return value;}};
  const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states:wrapped,operations,ownerships});
  const pending=accept({envelope:envelope(id),proposedState:proposed(id),creatorStateMutationAuthority:authority(id,credential)});
  await gate.reached;
  await ownerships.updateOne({projectId:project(id)},{$inc:{ownershipRevision:1}});
  gate.release();
  await assert.rejects(pending,e=>["MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","MongoServerError","WriteConflict"].includes(e?.code)||/WriteConflict|write conflict|TransientTransactionError/.test(e?.message||""),"C: stale transactional fence must not commit");
  const c=await counts(id);
  assert.equal(c.states,0,"C: no creator state committed");
  assert.equal(c.operations,0,"C: no operation record committed");
  assert.equal(c.ownership.ownershipRevision,2,"C: durable revision change persisted");
  assert.equal(c.ownership.creatorStateFenceEpoch,0,"C: stale fence did not commit");
  console.log("GREEN C: durable ownership change before fence denied stale transaction");
 }
 console.log("LIMITATION: isolated injected verifier, not live identity provider, HTTP composition, or approved emergency-suspension semantics.");
}finally{await mongoose.disconnect();}
