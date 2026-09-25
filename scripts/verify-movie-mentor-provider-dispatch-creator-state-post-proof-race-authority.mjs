import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorCreatorStateConsumptionAuthority } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
import { createCreatorStateConsumptionRuntimeDeps } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

console.log("5A.34 — provider dispatch Creator-state post-proof race authority");

const authorization=()=>({authorized:true,principalId:"creator-346",projectId:"project-346",ownershipRef:"ownership-346",ownershipRevision:1,authorizationSource:"verifier"});
const state=(revision,generation,fingerprint)=>({projectId:"project-346",creatorSessionId:"session-346",revision,creatorStateGeneration:generation,creatorStateFingerprint:fingerprint});
let durableState=state(12,8,"state-fingerprint-8");
let providerEffects=0;

const capability=createMovieMentorCreatorStateConsumptionAuthority({request:{},authorization:authorization(),requestAuthority:{authorize:async()=>authorization()}});
const guarded=createCreatorStateConsumptionRuntimeDeps({
  creatorStateConsumptionAuthority:capability,
  readAuthoritativeTurnSource:async()=>structuredClone(durableState),
  inferenceExecutionAuthority:{async assertProviderDispatch({providerCall}){return {dispatchAuthorized:true,executionId:providerCall.executionId,providerCallId:providerCall.providerCallId};}}
});

await guarded.readAuthoritativeTurnSource({projectId:"project-346"});
const dispatch=await guarded.inferenceExecutionAuthority.assertProviderDispatch({providerCall:{executionId:"execution-346",providerCallId:"provider-346"}});
assert.equal(dispatch.dispatchAuthorized,true,"precondition: provider dispatch proof must be current at proof time");

// Adversarial chronology: another live process advances Creator truth after the final
// current-state proof has returned but before this process crosses the irreversible
// external provider boundary.
durableState=state(13,9,"state-fingerprint-9");

// Current production has no Creator-state physical CAS/touch spanning this interval.
// A returned proof therefore remains usable by the caller even though its Creator
// universe is already stale at the instant the external effect begins.
if(dispatch.dispatchAuthorized===true) providerEffects+=1;

assert.equal(durableState.revision,13);
assert.equal(providerEffects,0,
  "SAFETY LAW: Creator-state movement after final dispatch proof but before irreversible provider effect must fence the provider effect.");

const runtimeSource=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
assert.match(runtimeSource,/await inferenceExecutionAuthority\.assertProviderDispatch\([\s\S]*?await providerFunction\(/,
  "production runtime must expose the exact proof→network chronology under testimony");

console.log("GREEN: post-proof Creator-state movement is physically serialized against irreversible provider dispatch.");
console.log("LAW: CURRENT AT CHECK TIME IS NOT CURRENT AT EFFECT TIME; CREATOR-STATE AUTHORITY MUST SURVIVE THE IRREVERSIBLE NETWORK BOUNDARY.");
