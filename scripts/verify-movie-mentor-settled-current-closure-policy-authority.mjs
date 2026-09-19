import assert from "node:assert/strict";
import { createMovieMentorInferenceExecutionClosureAuthority } from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,phase:"settled",executionId:"execution-settled-policy",creatorTurnId:"turn-settled-policy",principalId:"creator-settled-policy",projectId:"project-settled-policy",reservationId:"reservation-settled-policy",requestDigest:"request-settled-policy",providerCalls:[],providerCallsClaimed:0,frozenProviderCallCount:0,closureReference:"closure-settled-policy",closurePolicyVersion:"superseded-policy",closureCertificateDigest:"counterfeit-certificate"};
const store={async readExecution(){return structuredClone(execution);},async readProviderEffects(){return[];},async quarantineExecution(){throw new Error("superseded policy must fail before reality/quarantine authority");}};
const authority=createMovieMentorInferenceExecutionClosureAuthority({store});
const verdict=await authority.assertCurrentClosure({executionId:execution.executionId,closureReference:execution.closureReference});
assert.equal(verdict.authorized,false,"SETTLED history minted under a superseded closure policy must not re-mint current closure authority");
assert.equal(verdict.reason,"closure-policy-current-required");
console.log("GREEN: SETTLED superseded policy cannot re-mint current closure authority.");
console.log("LAW: SETTLEMENT MAY PRESERVE HISTORY. IT MAY NOT LAUNDER SUPERSEDED CLOSURE POLICY BACK INTO CURRENT AUTHORITY.");