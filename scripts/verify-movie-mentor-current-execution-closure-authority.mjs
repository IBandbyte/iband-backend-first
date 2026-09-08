import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionClosureAuthority, MOVIE_MENTOR_INFERENCE_EXECUTION_CLOSURE_POLICY_VERSION } from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const base={domain:"iband.movie-mentor.inference-execution-store",executionId:"execution-schema-court",creatorTurnId:"turn-schema-court",principalId:"creator-schema-court",projectId:"project-schema-court",reservationId:"reservation-schema-court",requestDigest:"request-schema-court",ownerId:"owner-schema-court",leaseGeneration:3,leaseReference:"lease-schema-court",fencingToken:"fence-schema-court",leaseAcquiredAt:new Date("2032-01-01T00:00:00.000Z"),leaseExpiresAt:new Date("2032-01-01T00:10:00.000Z"),maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,finalizedResultReference:"",finalizedCandidateReference:"",finalizedResultDigest:"",resultFinalizedAt:null,settledResultReference:"",settledCandidateReference:"",settledResultDigest:"",settledAt:null,abortedAt:null,abortReason:"",quarantinedAt:null,quarantineReason:"",quarantinedFromPhase:""};

function fakeModel(initial){
  let row=structuredClone(initial);let writes=0;
  const chain=value=>({lean(){return this;},async exec(){return structuredClone(value);}});
  return {
    get row(){return structuredClone(row);},get writes(){return writes;},
    findOne(){return chain(row);},
    findOneAndUpdate(filter,update){
      const matches=Object.entries(filter).every(([k,v])=>{if(k==="leaseExpiresAt"&&v?.$gt)return new Date(row[k])>new Date(v.$gt);if(k==="leaseExpiresAt"&&v?.$lte)return new Date(row[k])<=new Date(v.$lte);return row[k]===v;});
      if(matches){writes+=1;row={...row,...structuredClone(update.$set||{})};
      return chain(matches?row:null);
    }
  };
}

async function beginClosingCase(schema){
  const model=fakeModel({...base,schema,phase:"active",closureReference:"",frozenProviderCallCount:null,frozenProviderCallSetDigest:"",closingAt:null,closedFromExecutionGeneration:null,closurePolicyVersion:"",closureCertificateDigest:"",closedAt:null});
  const store=createMovieMentorInferenceExecutionMongoStore({mongoModel:model});
  const outcome=await store.beginClosing({executionId:base.executionId,ownerId:base.ownerId,leaseGeneration:base.leaseGeneration,leaseReference:base.leaseReference,fencingToken:base.fencingToken,closureReference:"closure-schema-court",frozenProviderCallCount:0,frozenProviderCallSetDigest:digest([]),closingAt:"2032-01-01T00:01:00.000Z",closurePolicyVersion:MOVIE_MENTOR_INFERENCE_EXECUTION_CLOSURE_POLICY_VERSION});
  return{outcome,model};
}

const current=await beginClosingCase(6);
const legacy=await beginClosingCase(5);

const frozenDigest=digest([]),closureReference="closure-legacy-closed";
const certificate={executionId:"execution-legacy-closed",creatorTurnId:"turn-legacy-closed",principalId:"creator-legacy-closed",projectId:"project-legacy-closed",reservationId:"reservation-legacy-closed",requestDigest:"request-legacy-closed",closureReference,frozenProviderCallSetDigest:frozenDigest,closurePolicyVersion:MOVIE_MENTOR_INFERENCE_EXECUTION_CLOSURE_POLICY_VERSION,realities:[]};
const legacyClosed={...base,schema:5,executionId:certificate.executionId,creatorTurnId:certificate.creatorTurnId,principalId:certificate.principalId,projectId:certificate.projectId,reservationId:certificate.reservationId,requestDigest:certificate.requestDigest,phase:"closed",closureReference,frozenProviderCallCount:0,frozenProviderCallSetDigest:frozenDigest,closingAt:new Date("2032-01-01T00:01:00.000Z"),closedFromExecutionGeneration:3,closurePolicyVersion:MOVIE_MENTOR_INFERENCE_EXECUTION_CLOSURE_POLICY_VERSION,closureCertificateDigest:digest(certificate),closedAt:new Date("2032-01-01T00:02:00.000Z")};
const legacyClosedModel=fakeModel(legacyClosed),legacyClosedStore=createMovieMentorInferenceExecutionMongoStore({mongoModel:legacyClosedModel});
const closure=createMovieMentorInferenceExecutionClosureAuthority({store:legacyClosedStore,effectStore:{async readEffect(){throw new Error("zero-call universe must not read effects");}},now:()=>new Date("2032-01-01T00:03:00.000Z")});
const historical=await closure.assertCurrentClosure({executionId:legacyClosed.executionId,closureReference,closureCertificateDigest:legacyClosed.closureCertificateDigest});

assert.equal(current.outcome.phase,"closing","current schema-6 execution must retain closure authority");
assert.equal(current.model.writes,1);
assert.deepEqual(
  {legacyPhase:legacy.outcome.phase,legacyWrites:legacy.model.writes,legacySchema:legacy.model.row.schema,historicalAuthorized:historical.authorized,historicalReason:historical.reason??null},
  {legacyPhase:"active",legacyWrites:0,legacySchema:5,historicalAuthorized:false,historicalReason:"execution-current-schema-required"},
  "legacy execution history must neither cross ACTIVE -> CLOSING as an implicit schema migration nor borrow recomputed reality as current CLOSED authority",
);

console.log("GREEN: execution history stays readable, but only current schema-6 records may enter CLOSING or return as current CLOSED authority.");
console.log("LAW: A CLOSURE TRANSITION MUST NOT DOUBLE AS A SCHEMA MIGRATION. HISTORY MAY SURVIVE; CURRENT CLOSURE AUTHORITY MAY NOT BE BORROWED.");
