import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorPolicyDecisionIngressAuthority} from "../ai/MovieMentorPolicyDecisionIngressAuthority.js";

const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const terminalProduction=fs.readFileSync(new URL("../ai/MovieMentorTerminalDispositionProductionAuthority.js",import.meta.url),"utf8");

assert.match(terminalProduction,/applyPolicyAuthorizedTerminalDisposition/,"#419 terminal executor must remain present.");
assert.match(server,/createMovieMentorPolicyDecisionIngressAuthority/,"RED: production boot does not compose a distinct Movie Mentor policy-decision ingress.");
assert.match(server,/creatorHttpAuthority!==false/,"policy ingress must fail closed unless creator HTTP authority remains false.");
assert.doesNotMatch(server,/createMovieMentorTurnRouter\(\{[^}]*policyDecisionIngressAuthority/,"creator router must not receive policy decision authority.");

const decision=Object.freeze({
 decisionId:"decision-420",
 principalId:"creator-420",
 reservationId:"reservation-420",
 executionId:"execution-420",
 decisionSource:"movie-mentor-enforcement",
 decisionKind:"policy-approved-terminal-reservation-release",
 decidedBy:"creator-policy-authority",
 policyVersion:"movie-mentor-enforcement-v1",
 caseReference:"case-420",
 entitlementRevision:12,
 decidedAt:"2026-10-07T18:45:00.000Z"
});

let terminalCalls=0;
const terminalDispositionAuthority={
 async applyPolicyAuthorizedTerminalDisposition({decision:received}){
  terminalCalls++;
  assert.deepEqual(received,decision);
  return Object.freeze({released:true,decisionId:received.decisionId});
 }
};

const denied=createMovieMentorPolicyDecisionIngressAuthority({
 authorizePolicyDecision:async()=>Object.freeze({authorized:false}),
 terminalDispositionAuthority
});
await assert.rejects(
 ()=>denied.applyPolicyDecision({request:{decision}}),
 error=>error?.code==="MOVIE_MENTOR_POLICY_DECISION_NOT_AUTHORIZED",
 "untrusted caller data must not self-authorize terminal disposition"
);
assert.equal(terminalCalls,0);

const authorized=createMovieMentorPolicyDecisionIngressAuthority({
 authorizePolicyDecision:async({request})=>request?.policyAuthorization===true
  ?Object.freeze({authorized:true,decision:request.decision})
  :Object.freeze({authorized:false}),
 terminalDispositionAuthority
});
const status=authorized.getStatus();
assert.equal(status.production,true);
assert.equal(status.trustedPolicyAuthorizationRequired,true);
assert.equal(status.creatorHttpAuthority,false);
assert.equal(status.legacyAdminAuthority,false);
assert.equal(status.processLocalFallback,false);

const result=await authorized.applyPolicyDecision({request:{policyAuthorization:true,decision}});
assert.equal(result.released,true);
assert.equal(terminalCalls,1);

await assert.rejects(
 ()=>authorized.applyPolicyDecision({request:{policyAuthorization:true,decision:{...decision,decisionKind:"creator-requested-release"}}}),
 error=>error?.code==="MOVIE_MENTOR_POLICY_DECISION_BINDING_INVALID",
 "wrong decision kind must fail closed before terminal execution"
);
assert.equal(terminalCalls,1);

console.log("GREEN: distinct production policy ingress requires explicit trusted policy authorization, preserves exact terminal decision coordinates, delegates once to #419, and is not exposed to creator HTTP.");
console.log("LAW: POLICY MAY AUTHORIZE TERMINAL VALUE DISPOSITION; CREATORS MAY NOT SELF-MINT THAT AUTHORITY, AND THE POLICY INGRESS MAY NOT MUTATE VALUE ITSELF.");
