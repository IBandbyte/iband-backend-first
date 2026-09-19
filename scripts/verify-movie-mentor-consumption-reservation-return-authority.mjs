import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorInferenceSettlementMongoStore} from "../ai/MovieMentorInferenceSettlementMongoStore.js";

const digest=v=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const stableDigest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const now=new Date("2032-01-01T00:10:00.000Z");
const payload={text:"authorized"};
const resultDigest=stableDigest(payload);
const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",phase:"finalized",ownerId:"owner-A",leaseGeneration:1,leaseReference:"lease-A",fencingToken:"fence-A",providerCallsClaimed:0,providerCalls:[],frozenProviderCallCount:0,frozenProviderCallSetDigest:digest([]),providerEffectRealityRevision:0,closureReference:"closure-A",closurePolicyVersion:"policy-A",finalizedResultReference:"result-A",finalizedCandidateReference:"candidate-A",finalizedResultDigest:resultDigest,resultFinalizedAt:"2032-01-01T00:09:00.000Z"};
const certificate={executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",closureReference:"closure-A",frozenProviderCallSetDigest:execution.frozenProviderCallSetDigest,closurePolicyVersion:"policy-A",realities:[]};
execution.closureCertificateDigest=digest(certificate);
const result={domain:"iband.movie-mentor.canonical-result-store",schema:2,executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",closureReference:"closure-A",closureCertificateDigest:execution.closureCertificateDigest,resultReference:"result-A",candidateReference:"candidate-A",resultDigest,resultPayload:payload};
const candidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:"candidate-A",executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",resultDigest,resultPayload:payload,stagedFromLeaseGeneration:1,stagedFromLeaseReference:"lease-A",stagedFromFencingToken:"fence-A",creatorStateFingerprint:"state-A",creatorStateRevision:0,creatorStateGeneration:1,creatorStateOwnershipRef:"ownership-A",creatorStateOwnershipRevision:1,stagedAt:"2032-01-01T00:08:00.000Z"};
const reservation={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"reservation-A",principalId:"creator-A",projectId:"project-A",operation:"movie-mentor-turn",units:2,status:"reserved"};
const entitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-A",status:"active",remainingUnits:8,reservedUnits:0,consumedUnits:2,entitlementRevision:2};
const counterfeit={...reservation,reservationId:"reservation-EVIL",principalId:"creator-EVIL",projectId:"project-EVIL",status:"released",settledAt:"1999-01-01T00:00:00.000Z",settlementReason:"counterfeit",settlementExecutionId:"execution-EVIL",settlementResultReference:"result-EVIL",settlementCandidateReference:"candidate-EVIL",settlementResultDigest:"digest-EVIL"};
const collections={
 movie_mentor_inference_execution:{findOne:async()=>execution,updateOne:async()=>({matchedCount:1})},
 movie_mentor_canonical_result:{findOne:async()=>result},
 movie_mentor_result_candidate:{findOne:async()=>candidate},
 movie_mentor_provider_effect_reality:{find:()=>({toArray:async()=>[]})},
 movie_mentor_inference_spend_reservation:{findOne:async()=>reservation,findOneAndUpdate:async()=>counterfeit},
 movie_mentor_inference_entitlement:{findOneAndUpdate:async()=>entitlement}
};
const session={withTransaction:async fn=>fn(),endSession:async()=>{}};
const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>({collection:name=>collections[name]}),now:()=>now});
console.log("Movie Mentor consumption reservation write return authority court");
await assert.rejects(()=>store.settleCanonicalResult({executionId:"execution-A"}),e=>e?.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_RESERVATION_RACE","successful consumed reservation write return must bind exact reservation identity, principal/project, consumed state, exact settlement instant and canonical lineage");
console.log("PASS: counterfeit truthy consumed-reservation write return is rejected.");
