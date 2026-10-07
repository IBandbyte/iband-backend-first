import fs from "node:fs";
import assert from "node:assert/strict";

const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const ingress=fs.readFileSync(new URL("../ai/MovieMentorPolicyDecisionIngressAuthority.js",import.meta.url),"utf8");
const operations=fs.readFileSync(new URL("../ai/MovieMentorOperationsMutationCapabilityControl.js",import.meta.url),"utf8");
const moderation=fs.readFileSync(new URL("../moderation.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../admin.js",import.meta.url),"utf8");

assert.match(ingress,/authorizePolicyDecision/,"#420 policy ingress must still require an authorization boundary.");
assert.match(server,/policyAuthorization===true/,"#420 production wiring must expose the exact authorization provenance under test.");
assert.doesNotMatch(server,/router=createMovieMentorTurnRouter\(\{[^}]*policyDecisionIngressAuthority/s,"creator HTTP must remain unable to receive the policy ingress authority.");

assert.match(operations,/standalone-dormant-not-wired/,"operations mutation capability must remain explicitly dormant and cannot be borrowed as live policy provenance.");
assert.doesNotMatch(moderation,/MovieMentorPolicyDecisionIngressAuthority|policyAuthorization/,"legacy moderation must not be borrowed as Movie Mentor policy authorization provenance.");
assert.doesNotMatch(admin,/MovieMentorPolicyDecisionIngressAuthority|policyAuthorization/,"legacy admin must not be borrowed as Movie Mentor policy authorization provenance.");

const callerSuppliedAuthorization=/authorizePolicyDecision:async\(\{request\}\)=>request\?\.policyAuthorization===true&&request\?\.decision/;
if(callerSuppliedAuthorization.test(server)){
 throw new Error("RED: production policy ingress treats caller-supplied policyAuthorization:true plus a decision as trusted authorization, but no distinct live policy/enforcement authority proves who may mint that authorization fact.");
}

console.log("GREEN: production policy ingress authorization is backed by a distinct live policy/enforcement provenance owner rather than a caller-supplied boolean.");
