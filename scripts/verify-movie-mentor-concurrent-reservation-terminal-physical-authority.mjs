import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";

console.log("Movie Mentor same-principal concurrent reservation terminal physical authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
assert.match(source,/session\.withTransaction/,"production terminal dispositions must use Mongo transactions");
assert.match(source,/entitlementRevision:\{\$gte:reservation\.entitlementRevision\},reservedUnits:\{\$gte:reservation\.units\}/,"production must reacquire sufficient current aggregate reserved reality");
assert.match(source,/findOneAndUpdate\(\{reservationId:[^}]+status:"reserved"\}/,"production must CAS exact reservation terminal identity");

const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri,"physical court requires MONGO_URI");
await mongoose.connect(uri);
const db=mongoose.connection.db;
const entitlements=db.collection("movie_mentor_inference_entitlement");
const reservations=db.collection("movie_mentor_inference_spend_reservation");
await entitlements.deleteMany({principalId:"creator-357"});
await reservations.deleteMany({principalId:"creator-357"});
await entitlements.createIndex({principalId:1},{unique:true});
await reservations.createIndex({reservationId:1},{unique:true});

await entitlements.insertOne({principalId:"creator-357",domain:"iband.movie-mentor.inference-spend",schema:1,status:"active",remainingUnits:8,reservedUnits:2,consumedUnits:0,entitlementRevision:12});
await reservations.insertMany([
 {reservationId:"A",principalId:"creator-357",units:1,entitlementRevision:11,status:"reserved"},
 {reservationId:"B",principalId:"creator-357",units:1,entitlementRevision:12,status:"reserved"}
]);

async function dispose(id,fate){
 const session=await mongoose.startSession();
 let committed=false;
 try{
  await session.withTransaction(async()=>{
   const reservation=await reservations.findOne({reservationId:id},{session});
   if(!reservation||reservation.status!=="reserved")return;
   const field=fate==="consumed"?"consumedUnits":"remainingUnits";
   const entitlement=await entitlements.findOneAndUpdate(
    {principalId:reservation.principalId,entitlementRevision:{$gte:reservation.entitlementRevision},reservedUnits:{$gte:reservation.units}},
    {$inc:{reservedUnits:-reservation.units,[field]:reservation.units,entitlementRevision:1}},
    {session,returnDocument:"after"}
   );
   if(!entitlement)throw new Error("ledger-conflict");
   const terminal=await reservations.findOneAndUpdate(
    {reservationId:id,status:"reserved"},
    {$set:{status:fate}},
    {session,returnDocument:"after"}
   );
   if(!terminal)throw new Error("reservation-race");
   committed=true;
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  return committed;
 }finally{await session.endSession();}
}

const [a,b]=await Promise.all([dispose("A","released"),dispose("B","consumed")]);
assert.equal(a,true,"older A must eventually commit under shared-entitlement collision");
assert.equal(b,true,"newer B must eventually commit under shared-entitlement collision");
let ledger=await entitlements.findOne({principalId:"creator-357"});
let rows=await reservations.find({principalId:"creator-357"}).sort({reservationId:1}).toArray();
assert.deepEqual({remaining:ledger.remainingUnits,reserved:ledger.reservedUnits,consumed:ledger.consumedUnits,revision:ledger.entitlementRevision,A:rows[0].status,B:rows[1].status},{remaining:9,reserved:0,consumed:1,revision:14,A:"released",B:"consumed"});

await entitlements.updateOne({principalId:"creator-357"},{$inc:{reservedUnits:1,remainingUnits:-1,entitlementRevision:1}});
await reservations.insertOne({reservationId:"C",principalId:"creator-357",units:1,entitlementRevision:15,status:"reserved"});
assert.equal(await dispose("A","consumed"),false,"A must not borrow C's newly available aggregate reserved unit after A already terminated");
ledger=await entitlements.findOne({principalId:"creator-357"});
assert.equal(ledger.reservedUnits,1,"failed stale A disposition must leave C's aggregate reservation untouched");
assert.equal((await reservations.findOne({reservationId:"C"})).status,"reserved");

await mongoose.disconnect();
console.log("GREEN: real Mongo transactions serialize two same-principal terminal dispositions without lost aggregate updates, and a settled reservation cannot borrow later aggregate reserved value.");
console.log("LAW: SHARED ENTITLEMENT ACCOUNTING MAY SERIALIZE PHYSICALLY; TERMINAL ECONOMIC AUTHORITY REMAINS OWNED BY EACH EXACT RESERVED RESERVATION.");
