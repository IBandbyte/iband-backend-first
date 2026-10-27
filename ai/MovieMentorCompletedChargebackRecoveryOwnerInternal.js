import {randomUUID} from "node:crypto";
import mongoose from "mongoose";

// Internal building block only. Not wired into production recovery or financial
// settlement until the independent integration court proves the entire boundary.
const COLLECTION="movie_mentor_completed_chargeback_recovery_lease";
const SCOPE="completed-chargeback:stripe";
const FENCED="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED";
// Only this module can mint a capability. The owner/generation fields are not proof.
const mintedCapabilities=new WeakMap();
function mint(owner,generation,connection){const capability=Object.freeze({owner,generation});mintedCapabilities.set(capability,connection);return capability;}
function fail(message){const error=new Error(message);error.code=FENCED;throw error;}
function assertConnection(connection){
 if(!connection?.db||typeof connection.startSession!=="function")fail("Durable recovery ownership requires an active MongoDB connection.");
}
function collection(connection){assertConnection(connection);return connection.db.collection(COLLECTION);}
function ownerToken(){return randomUUID();}
async function acquireRecoveryOwner({connection=mongoose.connection,owner=ownerToken(),leaseMs=30000}={}){
 if(typeof owner!=="string"||!owner||!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>300000)fail("Invalid internal recovery lease request.");
 const leases=collection(connection);
 // Only the first claimant may create generation 1. Concurrent inserts lose
 // against the unique _id index; no claimant may reset a prior generation.
 try{
  await leases.insertOne({_id:SCOPE,owner,generation:1,writerFenceRevision:0,leaseUntil:new Date(Date.now()+leaseMs)});
  return mint(owner,1,connection);
 }catch(error){if(error?.code!==11000)throw error;}
 // A takeover is allowed only after expiry as measured by MongoDB server time.
 // Update pipeline uses $$NOW to set expiry on the server and increments the
 // generation atomically, without relying on the claimant's local clock.
 const result=await leases.findOneAndUpdate(
  {_id:SCOPE,$expr:{$lte:["$leaseUntil","$$NOW"]}},
  [{$set:{owner,generation:{$add:["$generation",1]},leaseUntil:{$dateAdd:{startDate:"$$NOW",unit:"millisecond",amount:leaseMs}}}}],
  {returnDocument:"after"}
 );
 const row=result?.value??result;
 if(!row||row.owner!==owner||!Number.isSafeInteger(row.generation))fail("Recovery ownership is held by another generation.");
 return mint(owner,row.generation,connection);
}
async function runWithRecoveryFence({connection=mongoose.connection,capability,work}={}){
 if(!capability||mintedCapabilities.get(capability)!==connection||typeof capability.owner!=="string"||!Number.isSafeInteger(capability.generation)||capability.generation<1||typeof work!=="function")fail("Internal recovery fence requires acquired owner generation and transaction callback.");
 const leases=collection(connection);
 const session=await connection.startSession();
 try{
  return await session.withTransaction(async()=>{
   const fence=await leases.updateOne(
    {_id:SCOPE,owner:capability.owner,generation:capability.generation,$expr:{$gt:["$leaseUntil","$$NOW"]}},
    {$inc:{writerFenceRevision:1}},{session}
   );
   if(fence.acknowledged!==true||fence.matchedCount!==1||fence.modifiedCount!==1)fail("Recovery owner generation expired or was superseded.");
   // The caller must use the supplied session for EVERY financial read/write.
   // The integration verifier must prove this physically before activation.
   return work(session);
  });
 }finally{await session.endSession();}
}
export {COLLECTION as MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION,acquireRecoveryOwner,runWithRecoveryFence};
