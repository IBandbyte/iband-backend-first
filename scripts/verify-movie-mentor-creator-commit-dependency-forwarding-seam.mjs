import assert from "node:assert/strict";
import {bindCreatorDecisionCommitToTurn} from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

// Characterization only. This is an internal dependency seam, not proof of an external injection route.
const observed=[];
const baseCommit=async(args,deps)=>{observed.push({args,deps});return {status:"observed"};};
const bound=bindCreatorDecisionCommitToTurn({creatorTurnId:"server-turn"},{commitCreatorDecision:baseCommit});
const forged={creatorTurnId:"attacker-turn",projectId:"project-1"};
const injected={writeAuthoritativeCreatorState:async()=>{},creatorStateMutationAuthority:{fake:true},executionEvidence:{fake:true}};
await bound(forged,injected);
assert.equal(observed.length,1);
assert.equal(observed[0].args.creatorTurnId,"server-turn","stable turn binding must override caller input");
assert.strictEqual(observed[0].deps,injected,"existing binder forwards commit dependencies unchanged");
assert.strictEqual(observed[0].deps.writeAuthoritativeCreatorState,injected.writeAuthoritativeCreatorState);
console.log(JSON.stringify({court:"creator-commit-dependency-forwarding-seam",stableTurnOverride:"enforced",commitDependenciesForwarded:"unchanged",externalReachability:"not demonstrated",classification:"audit-only seam characterization; NOT production exploit or repair GREEN"}));
console.log("PASS: binder fixes turn ID but forwards caller-provided dependency object");
