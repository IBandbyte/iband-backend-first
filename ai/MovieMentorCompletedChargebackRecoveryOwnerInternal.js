import {randomUUID} from "node:crypto";
import mongoose from "mongoose";

// Internal building block only. Not wired into production recovery or financial
// settlement until the independent integration court proves the entire boundary.
const COLLECTION="movie_mentor_completed_chargeback_recovery_lease";
const SCOPE="completed-chargeback:stripe";
const FENCED="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED";
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
  return Object.freeze({owner,generation:1});
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
 return Object.freeze({owner,generation:row.generation});
}
async function runWithRecoveryFence({connection=mongoose.connection,capability,work}={}){
 if(!capability||typeof capability.owner!=="string"||!Number.isSafeInteger(capability.generation)||capability.generation<1||typeof work!=="function")fail("Internal recovery fence requires acquired owner generation and transaction callback.");
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
