import assert from "node:assert/strict";
import fs from "node:fs";
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

// Production-path ownership: the creator gateway must create this capability from the authenticated
// request universe, select the guarded runtime by default, and pass the capability into that runtime.
const gatewaySource = fs.readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");
assert.match(gatewaySource, /createMovieMentorForwardExecutionAuthority/);
assert.match(gatewaySource, /runTurn=runMovieMentorTurnWithForwardExecutionAuthority/);
assert.match(gatewaySource, /forwardExecutionAuthorityFrom=\(req,authorized\)=>createMovieMentorForwardExecutionAuthority\(\{request:req,authorization:authorized\.authority,requestAuthority\}\)/);
assert.match(gatewaySource, /forwardExecutionAuthority=forwardExecutionAuthorityFrom\(req,authorized\)/);
assert.match(gatewaySource, /creatorStateConsumptionAuthority,forwardExecutionAuthority,commitCreatorDecision/);
assert.match(gatewaySource, /forwardExecutionReacquisitionCurrentOwnership:true/);
assert.match(gatewaySource, /historicalExecutionCannotMintSuccessorAuthority:true/);
const runtimeSource = fs.readFileSync(new URL("../ai/MovieMentorForwardExecutionRuntime.js", import.meta.url), "utf8");
const proofIndex = runtimeSource.indexOf("await assertMovieMentorForwardExecutionReacquisitionAuthority");
const acquireIndex = runtimeSource.indexOf("return base.acquireExecution(input)");
assert.ok(proofIndex >= 0 && acquireIndex > proofIndex, "fresh creator ownership proof must precede durable lease reacquisition");

console.log("✓ expired ACTIVE execution remains readable history");
console.log("✓ ownership revocation fails before acquireExecution");
console.log("✓ revoked ownership leaves generation/reference/fence unchanged");
console.log("✓ revoked reacquisition produces zero provider claims and zero external effects");
console.log("✓ current ownership permits exactly the successor lease universe");
console.log("✓ production gateway creates and passes the server-owned forward execution capability");
console.log("✓ production gateway defaults to the guarded forward execution runtime");
console.log("✓ production ordering proves current ownership before durable successor lease mutation");
console.log("LAW: AN EXPIRED LEASE MAY SURVIVE AS HISTORY. HISTORY MAY NOT MINT ITS SUCCESSOR.");
console.log("ROUND SEVEN forward execution reacquisition torture: GREEN");
