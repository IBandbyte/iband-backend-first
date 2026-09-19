import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceExecutionClosureAuthority } from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const calls=[];
const record={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-policy-contract",creatorTurnId:"turn-policy-contract",principalId:"creator-policy-contract",projectId:"project-policy-contract",reservationId:"reservation-policy-contract",requestDigest:"request-policy-contract",phase:"settled",providerCalls:calls,frozenProviderCallCount:0,frozenProviderCallSetDigest:crypto.createHash("sha256").update(JSON.stringify([])).digest("hex"),closureReference:"closure-policy-contract",closurePolicyVersion:"superseded-policy",providerEffectRealityRevision:0};
const certificate={executionId:record.executionId,creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,reservationId:record.reservationId,requestDigest:record.requestDigest,closureReference:record.closureReference,frozenProviderCallSetDigest:record.frozenProviderCallSetDigest,closurePolicyVersion:record.closurePolicyVersion,realities:[]};
record.closureCertificateDigest=crypto.createHash("sha256").update(JSON.stringify(certificate)).digest("hex");
const authority=createMovieMentorInferenceExecutionClosureAuthority({store:{readExecution:async()=>record,beginClosing:async()=>{throw new Error("unused");},recoverExpiredIntoClosing:async()=>{throw new Error("unused");},completeClosing:async()=>{throw new Error("unused");},quarantineExecution:async()=>{throw new Error("superseded policy should fail closed without laundering through quarantine");}},effectStore:{readEffect:async()=>null}});
const result=await authority.assertCurrentClosure({executionId:record.executionId,closureReference:record.closureReference,closureCertificateDigest:record.closureCertificateDigest});
assert.notEqual(result.authorized,true,"closure authority itself must not call superseded closure-policy provenance current");
console.log("GREEN: closure authority refuses superseded policy at its own current-authority contract.");
console.log("LAW: A CURRENT-CLOSURE AUTHORITY MUST OWN CURRENT POLICY; DOWNSTREAM CONSUMERS MAY NOT HAVE TO REDISCOVER ITS DEFINITION.");
