import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {bindCreatorDecisionCommitToTurn} from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";
// Real production call-chain interface court, no DB, no writes.
// RED identifies unsealed commit dependency ingress; not proof that public input can inject it.
const consumption=readFileSync(new URL("../ai/MovieMentorCreatorStateConsumptionRuntime.js",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const decision=readFileSync(new URL("../ai/MovieMentorCreatorDecisionAuthority.js",import.meta.url),"utf8");
const forwarded=/baseCommit\(\{\s*\.\.\.args,\s*creatorTurnId\s*\},\s*commitDeps\)/.test(consumption);
const runtimeInjected=/commitCreatorDecision:\s*deps\.commitCreatorDecision/.test(runtime);
const decisionInjected=/deps\.applyMovieMentorCreatorStateTransition\s*\|\|/.test(decision)&&/deps\.writeAuthoritativeCreatorState/.test(decision);
assert.equal(typeof bindCreatorDecisionCommitToTurn,"function");
const seen=[];
const bound=bindCreatorDecisionCommitToTurn({creatorTurnId:"turn-verified"},{commitCreatorDecision:async (args,deps)=>{seen.push({args,deps});return "captured";}});
const untrusted={writeAuthoritativeCreatorState:async()=>{},creatorStateMutationAuthority:{authorized:true}};
await bound({creatorTurnId:"caller-turn"},untrusted);
const observed=seen.length===1&&seen[0].args.creatorTurnId==="turn-verified"&&seen[0].deps===untrusted;
console.log(JSON.stringify({court:"production-commit-dependency-authority-boundary",turnIdServerBound:observed,commitDepsForwardedUnchanged:forwarded,runtimeCommitDependencyInjected:runtimeInjected,decisionAcceptsInjectedStateAuthority:decisionInjected,classification:"real production call-chain interface court; external reachability NOT established; no physical transaction"}));
assert.equal(observed,true);
assert.equal(forwarded,false,"TRUST BOUNDARY RED: production turn binder forwards caller-provided commitDeps without server-controlled sealing");
assert.equal(runtimeInjected,false,"TRUST BOUNDARY RED: runtime must bind production commit authority rather than accepting a replaceable orchestration dependency");
assert.equal(decisionInjected,false,"TRUST BOUNDARY RED: creator-decision production commit must not accept arbitrary writer and mutation authority dependencies");
