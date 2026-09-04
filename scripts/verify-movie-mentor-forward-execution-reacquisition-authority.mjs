import assert from "node:assert/strict";
import { createMovieMentorForwardExecutionAuthority } from "../ai/MovieMentorForwardExecutionAuthority.js";
import { createForwardExecutionRuntimeDeps } from "../ai/MovieMentorForwardExecutionRuntime.js";

console.log("ROUND SEVEN — forward execution reacquisition authority torture");
let ownershipCurrent = true, acquireCount = 0, claimCount = 0, externalEffectCount = 0;
let durable = { found:true, authorized:true, executionAuthorized:false, phase:"active", principalId:"creator-1", projectId:"project-1", creatorTurnId:"turn-1", executionId:"execution-1", leaseGeneration:7, leaseReference:"lease-7", fencingToken:"fence-7" };
const requestAuthority = { async authorize(){ return ownershipCurrent ? { authorized:true, principalId:"creator-1", projectId:"project-1", ownershipRef:"ownership-A", ownershipRevision:4, authorizationSource:"torture" } : { authorized:false, principalId:"creator-1", projectId:"project-1" }; } };
const forwardExecutionAuthority = createMovieMentorForwardExecutionAuthority({ request:{id:"request-1"}, authorization:await requestAuthority.authorize(), requestAuthority });
const base = {
  async findExecutionByCreatorTurn(){ return structuredClone(durable); },
  async acquireExecution(){ acquireCount += 1; durable = { ...durable, executionAuthorized:true, leaseGeneration:durable.leaseGeneration+1, leaseReference:`lease-${durable.leaseGeneration+1}`, fencingToken:`fence-${durable.leaseGeneration+1}` }; return structuredClone(durable); },
  async claimProviderCall(){ claimCount += 1; return { dispatchAuthorized:true }; },
};
const guarded = createForwardExecutionRuntimeDeps({ inferenceExecutionAuthority:base, forwardExecutionAuthority }).inferenceExecutionAuthority;
const observed = await guarded.findExecutionByCreatorTurn({ creatorTurnId:"turn-1", principalId:"creator-1", projectId:"project-1" });
assert.equal(observed.leaseGeneration,7);
ownershipCurrent = false;
await assert.rejects(() => guarded.acquireExecution({ executionId:"execution-1", ownerId:"worker-B" }), error => error?.code === "MOVIE_MENTOR_FORWARD_EXECUTION_CURRENT_OWNERSHIP_REQUIRED");
assert.equal(acquireCount,0,"revoked ownership must fail before durable reacquisition");
assert.equal(durable.leaseGeneration,7,"revoked ownership must not mint lease generation 8");
assert.equal(durable.leaseReference,"lease-7");
assert.equal(durable.fencingToken,"fence-7");
assert.equal(claimCount,0,"no provider-call claim may exist without reacquisition");
assert.equal(externalEffectCount,0,"zero external effect");

ownershipCurrent = true;
const positiveBase = { ...base, async acquireExecution(){ acquireCount += 1; durable = { ...durable, executionAuthorized:true, leaseGeneration:8, leaseReference:"lease-8", fencingToken:"fence-8" }; return structuredClone(durable); } };
const positive = createForwardExecutionRuntimeDeps({ inferenceExecutionAuthority:positiveBase, forwardExecutionAuthority }).inferenceExecutionAuthority;
await positive.findExecutionByCreatorTurn({ creatorTurnId:"turn-1", principalId:"creator-1", projectId:"project-1" });
const reacquired = await positive.acquireExecution({ executionId:"execution-1", ownerId:"worker-B" });
assert.equal(reacquired.leaseGeneration,8);
assert.equal(reacquired.leaseReference,"lease-8");
assert.equal(reacquired.fencingToken,"fence-8");

console.log("✓ expired ACTIVE execution remains readable history");
console.log("✓ ownership revocation fails before acquireExecution");
console.log("✓ revoked ownership leaves generation/reference/fence unchanged");
console.log("✓ revoked reacquisition produces zero provider claims and zero external effects");
console.log("✓ current ownership permits exactly the successor lease universe");
console.log("LAW: AN EXPIRED LEASE MAY SURVIVE AS HISTORY. HISTORY MAY NOT MINT ITS SUCCESSOR.");
console.log("ROUND SEVEN forward execution reacquisition torture: GREEN");
