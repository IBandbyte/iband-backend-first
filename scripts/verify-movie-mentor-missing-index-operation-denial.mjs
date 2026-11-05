import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionPhysicalAuthority} from "../ai/MovieMentorInferenceExecutionPhysicalAuthority.js";
import {createMovieMentorInferenceSettlementPhysicalAuthority} from "../ai/MovieMentorInferenceSettlementPhysicalAuthority.js";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//);
await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:5000});
try{
 const readIndexes=async name=>mongoose.connection.db.collection(name).indexes();
 let executionDelegations=0,settlementDelegations=0;
 const executionMethods=["readExecution","readExecutionByCreatorTurn","createExecution","replaceExecution","claimProviderCall","beginClosing","recoverExpiredIntoClosing","completeClosing","quarantineExecution"];
 const executionStore=Object.fromEntries(executionMethods.map(name=>[name,async()=>{executionDelegations++;throw Error("Unexpected execution delegation: "+name)}]));
 const settlementStore={settleCanonicalResult:async()=>{settlementDelegations++;throw Error("Unexpected settlement delegation")},releaseUnclaimedReservation:async()=>{settlementDelegations++;throw Error("Unexpected settlement delegation")},releaseUnboundReservation:async()=>{settlementDelegations++;throw Error("Unexpected settlement delegation")}};
 const execution=createMovieMentorInferenceExecutionPhysicalAuthority({store:executionStore,readIndexes});
 const settlement=createMovieMentorInferenceSettlementPhysicalAuthority({store:settlementStore,readIndexes});
 await assert.rejects(()=>execution.readExecution({executionId:"isolated"}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_PHYSICAL_AUTHORITY_UNAVAILABLE");
 await assert.rejects(()=>settlement.releaseUnclaimedReservation({reservationId:"isolated"}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHYSICAL_AUTHORITY_UNAVAILABLE");
 assert.equal(executionDelegations,0,"Execution must deny before delegating to durable store");
 assert.equal(settlementDelegations,0,"Settlement must deny before delegating to durable store");
 console.log("GREEN: real physical index readers against fresh disposable Mongo deny execution and settlement before durable store delegation; no production writes.");
}finally{await mongoose.disconnect();}
