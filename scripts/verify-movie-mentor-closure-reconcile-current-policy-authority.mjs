import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceExecutionClosureAuthority } from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const calls=[];
const record={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-reconcile-policy",creatorTurnId:"turn-reconcile-policy",principalId:"creator-reconcile-policy",projectId:"project-reconcile-policy",reservationId:"reservation-reconcile-policy",requestDigest:"request-reconcile-policy",phase:"closing",providerCalls:calls,frozenProviderCallCount:0,frozenProviderCallSetDigest:crypto.createHash("sha256").update(JSON.stringify([])).digest("hex"),closureReference:"closure-reconcile-policy",closurePolicyVersion:"superseded-policy",providerEffectRealityRevision:0};
let completed=false;
const authority=createMovieMentorInferenceExecutionClosureAuthority({store:{readExecution:async()=>record,beginClosing:async()=>{throw new Error("unused");},recoverExpiredIntoClosing:async()=>{throw new Error("unused");},completeClosing:async()=>{completed=true;return {...record,phase:"closed",closureCertificateDigest:"should-not-be-written"};},quarantineExecution:async()=>{throw new Error("superseded policy should fail closed before reality mutation");}},effectStore:{readEffect:async()=>null}});
const result=await authority.reconcile({executionId:record.executionId});
assert.equal(completed,false,"reconcile must not complete a closing execution minted under superseded closure policy");
assert.notEqual(result.authorized,true,"reconcile must not authorize superseded closure-policy provenance");
console.log("GREEN: closure reconciliation refuses superseded policy before closure completion.");
console.log("LAW: RECONCILIATION MAY RECOVER CURRENT REALITY; IT MAY NOT UPGRADE OBSOLETE POLICY INTO CURRENT AUTHORITY.");
