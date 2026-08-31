import fs from "node:fs";

function mustReplace(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  return source.replace(from, to);
}

const settlementPath = "ai/MovieMentorInferenceSettlementMongoStore.js";
let settlement = fs.readFileSync(settlementPath, "utf8");
settlement = mustReplace(settlement, 'const VERSION="1.5.0",DOMAIN="iband.movie-mentor.inference-settlement-store";', 'const VERSION="1.6.0",DOMAIN="iband.movie-mentor.inference-settlement-store";', "settlement version");
settlement = mustReplace(
  settlement,
  'function reservationIdentityValid(reservation,{reservationId,principalId,projectId}){return reservation&&reservation.domain===SPEND_DOMAIN&&reservation.schema===1&&text(reservation.reservationId)===text(reservationId)&&text(reservation.principalId)===text(principalId)&&text(reservation.projectId)===text(projectId)&&text(reservation.operation)==="movie-mentor-turn"&&Number.isSafeInteger(reservation.units)&&reservation.units>0;}',
  'function reservationIdentityValid(reservation,{reservationId,principalId,projectId}){return reservation&&reservation.domain===SPEND_DOMAIN&&reservation.schema===1&&text(reservation.reservationId)===text(reservationId)&&text(reservation.principalId)===text(principalId)&&text(reservation.projectId)===text(projectId)&&text(reservation.operation)==="movie-mentor-turn"&&Number.isSafeInteger(reservation.units)&&reservation.units>0;}\nfunction explicitSettlementBinding(reservation){return[text(reservation?.settlementExecutionId),text(reservation?.settlementResultReference),text(reservation?.settlementCandidateReference),text(reservation?.settlementResultDigest)].every(Boolean);}\nfunction reservationSettlementBindingValid(reservation,execution,result,candidate){return text(reservation?.status)==="consumed"&&Boolean(iso(reservation?.settledAt))&&text(reservation?.settlementReason)===`canonical-result:${text(result?.resultReference)}`&&explicitSettlementBinding(reservation)&&text(reservation?.settlementExecutionId)===text(execution?.executionId)&&text(reservation?.settlementResultReference)===text(result?.resultReference)&&text(reservation?.settlementCandidateReference)===text(candidate?.candidateReference)&&text(reservation?.settlementResultDigest)===text(result?.resultDigest);}',
  "settlement binding helpers",
);
settlement = mustReplace(
  settlement,
  'if(text(execution.phase)==="settled"){if(text(reservation.status)!=="consumed"||!settledBindingValid(execution,result,candidate))fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_SETTLED_CONFLICT","SETTLED execution must bind an already-consumed exact canonical reservation.",{retryable:false});outcome=Object.freeze({settled:true,authorized:true,outcome:"consumed",idempotent:true,executionId:id,reservationId:text(reservation.reservationId),principalId:text(reservation.principalId),projectId:text(reservation.projectId),resultReference:text(result.resultReference),candidateReference:text(candidate.candidateReference),resultDigest:text(result.resultDigest),closureCertificateDigest:certificateDigest,providerEffectRealityRevision:realityRevision,resultFinalizationVerified:true,executionPhase:"settled"});return;}const settledAt=new Date(now());const barrier=',
  'if(text(execution.phase)==="settled"){if(!settledBindingValid(execution,result,candidate)||!reservationSettlementBindingValid(reservation,execution,result,candidate))fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_SETTLED_CONFLICT","SETTLED execution must bind an already-consumed exact canonical reservation and explicit durable debit lineage.",{retryable:false});outcome=Object.freeze({settled:true,authorized:true,outcome:"consumed",idempotent:true,executionId:id,reservationId:text(reservation.reservationId),principalId:text(reservation.principalId),projectId:text(reservation.projectId),resultReference:text(result.resultReference),candidateReference:text(candidate.candidateReference),resultDigest:text(result.resultDigest),closureCertificateDigest:certificateDigest,providerEffectRealityRevision:realityRevision,resultFinalizationVerified:true,executionPhase:"settled",explicitDebitBindingVerified:true});return;}if(text(reservation.status)==="consumed"){if(!Boolean(iso(reservation.settledAt))||text(reservation.settlementReason)!==`canonical-result:${text(result.resultReference)}`)fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHASE_LEDGER_CONFLICT","Legacy consumed reservation does not prove this exact canonical result.",{retryable:false});if(explicitSettlementBinding(reservation)&&!reservationSettlementBindingValid(reservation,execution,result,candidate))fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHASE_LEDGER_CONFLICT","Consumed reservation carries conflicting explicit settlement lineage.",{retryable:false});const historicalSettledAt=new Date(reservation.settledAt),backfill=await reservations.updateOne({reservationId:text(reservation.reservationId),status:"consumed",settlementReason:`canonical-result:${text(result.resultReference)}`},{$set:{settlementExecutionId:id,settlementResultReference:text(result.resultReference),settlementCandidateReference:text(candidate.candidateReference),settlementResultDigest:text(result.resultDigest)}},{session});if(backfill.matchedCount!==1)fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_RESERVATION_RACE","Consumed legacy reservation changed during settlement proof migration.",{retryable:true});const migrated=await executions.updateOne({executionId:id,phase:"finalized",closureReference:text(execution.closureReference),closureCertificateDigest:certificateDigest,finalizedResultReference:text(result.resultReference),finalizedCandidateReference:text(candidate.candidateReference),finalizedResultDigest:text(result.resultDigest),...revisionFilter},{$set:{phase:"settled",settledResultReference:text(result.resultReference),settledCandidateReference:text(candidate.candidateReference),settledResultDigest:text(result.resultDigest),settledAt:historicalSettledAt},$inc:{settlementRealityBarrierRevision:1}},{session});if(migrated.matchedCount!==1)fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_REALITY_RACE","Finalized result or provider-effect reality changed during legacy settlement proof migration.",{retryable:true});outcome=Object.freeze({settled:true,authorized:true,outcome:"consumed",idempotent:true,legacySettlementMigrated:true,explicitDebitBindingVerified:true,executionId:id,reservationId:text(reservation.reservationId),principalId:text(reservation.principalId),projectId:text(reservation.projectId),resultReference:text(result.resultReference),candidateReference:text(candidate.candidateReference),resultDigest:text(result.resultDigest),closureCertificateDigest:certificateDigest,providerEffectRealityRevision:realityRevision,resultFinalizationVerified:true,executionPhase:"settled"});return;}const settledAt=new Date(now());const barrier=',
  "settled idempotence and legacy migration",
);
settlement = mustReplace(
  settlement,
  'if(barrier.matchedCount!==1)fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_REALITY_RACE","Finalized result or provider-effect reality changed during settlement reconciliation.",{retryable:true});if(text(reservation.status)==="consumed")fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHASE_LEDGER_CONFLICT","Reservation is consumed but execution had not durably entered SETTLED in the same authority transaction.",{retryable:false});if(text(reservation.status)!=="reserved")',
  'if(barrier.matchedCount!==1)fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_REALITY_RACE","Finalized result or provider-effect reality changed during settlement reconciliation.",{retryable:true});if(text(reservation.status)!=="reserved")',
  "remove obsolete consumed conflict",
);
settlement = mustReplace(
  settlement,
  '{$set:{status:"consumed",settledAt,settlementReason:`canonical-result:${text(result.resultReference)}`}}, {returnDocument:"after",session}',
  '{$set:{status:"consumed",settledAt,settlementReason:`canonical-result:${text(result.resultReference)}`,settlementExecutionId:id,settlementResultReference:text(result.resultReference),settlementCandidateReference:text(candidate.candidateReference),settlementResultDigest:text(result.resultDigest)}}, {returnDocument:"after",session}',
  "write explicit debit lineage",
);
settlement = mustReplace(
  settlement,
  'resultFinalizationVerified:true,executionPhase:"settled"});},{readConcern:',
  'resultFinalizationVerified:true,executionPhase:"settled",explicitDebitBindingVerified:true});},{readConcern:',
  "new settlement outcome proof",
);
fs.writeFileSync(settlementPath, settlement);

const spendPath = "ai/MovieMentorInferenceSpendMongoStore.js";
let spend = fs.readFileSync(spendPath, "utf8");
spend = mustReplace(spend, 'const VERSION="1.2.0",DOMAIN="iband.movie-mentor.inference-spend",SCHEMA=1;', 'const VERSION="1.3.0",DOMAIN="iband.movie-mentor.inference-spend",SCHEMA=1;', "spend store version");
spend = mustReplace(
  spend,
  'settledAt:{type:Date,default:null},settlementReason:{type:String,default:null}',
  'settledAt:{type:Date,default:null},settlementReason:{type:String,default:null},settlementExecutionId:{type:String,default:null,immutable:true},settlementResultReference:{type:String,default:null,immutable:true},settlementCandidateReference:{type:String,default:null,immutable:true},settlementResultDigest:{type:String,default:null,immutable:true}',
  "reservation explicit settlement schema",
);
spend = mustReplace(
  spend,
  'settlementReason:text(v.settlementReason)||null});}',
  'settlementReason:text(v.settlementReason)||null,settlementExecutionId:text(v.settlementExecutionId)||null,settlementResultReference:text(v.settlementResultReference)||null,settlementCandidateReference:text(v.settlementCandidateReference)||null,settlementResultDigest:text(v.settlementResultDigest)||null});}',
  "reservation normalization",
);
fs.writeFileSync(spendPath, spend);

console.log("settled legacy migration patch applied");
