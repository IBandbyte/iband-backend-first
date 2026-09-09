import assert from "node:assert/strict";
import {createMovieMentorProductionInferenceExecutionComposition} from "../ai/MovieMentorProductionInferenceExecutionComposition.js";
import {getMovieMentorCanonicalResultMongoStoreStatus} from "../ai/MovieMentorCanonicalResultMongoStore.js";

const previousMongoUri=process.env.MONGO_URI;
process.env.MONGO_URI="mongodb://127.0.0.1:27017/movie-mentor-composition-verifier";
try{
  const resultStatus=getMovieMentorCanonicalResultMongoStoreStatus();
  assert.equal(resultStatus.configured,true,"court requires production store capability status to be enabled without opening network I/O");
  assert.equal(resultStatus.candidateLineage,"proof-bearing-provenance-revalidated-in-finalization-transaction","court must target the stronger canonical candidate-lineage capability actually emitted by the current store");
  const composition=createMovieMentorProductionInferenceExecutionComposition();
  console.log("production composition reason:",composition.reason);
  console.log("candidate capability status:",composition.candidateStoreStatus);
  assert.notEqual(composition.reason,"canonical-result-capability-not-proven","production composition must recognize the stronger proof-bearing canonical lineage capability rather than treating it as unproven");
  assert.equal(composition.ready,true,"current production-owned stores with current capability attestations must compose into live inference authority");
  assert.equal(composition.status?.fullExecutionAuthority,true);
  assert.equal(composition.status?.resultCandidateCurrentExecutionSchemaRequired,true,"production composition must advertise current execution schema as an owned candidate capability");
  console.log("✓ production composition recognizes the current proof-bearing canonical candidate-lineage capability");
  console.log("✓ production composition owns current execution schema at result-candidate staging");
  console.log("LAW: A STRONGER OWNED PROOF MUST PROPAGATE THROUGH PRODUCTION COMPOSITION; STALE CAPABILITY STRINGS MAY NOT REVOKE A VALID CURRENT IMPLEMENTATION.");
  console.log("canonical lineage production composition authority gate: GREEN");
} finally {
  if(previousMongoUri===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=previousMongoUri;
}
