import fs from "node:fs";

function read(path){ return fs.readFileSync(path,"utf8"); }
function assert(condition,message){ if(!condition) throw new Error(message); }

const server=read("server.js");
const terminalProduction=read("ai/MovieMentorTerminalDispositionProductionAuthority.js");
const reinstatementDecision=read("ai/MovieMentorReinstatementDecisionMongoStore.js");
const terminalDecision=read("ai/MovieMentorTerminalDispositionDecisionMongoStore.js");
const moderation=read("moderation.js");
const admin=read("admin.js");
const operations=read("ai/MovieMentorOperationsControlPlane.js");
const mutationControl=read("ai/MovieMentorOperationsMutationCapabilityControl.js");

assert(/recordAuthorizedDecision/.test(reinstatementDecision),"Precondition failed: #415 durable reinstatement decision owner missing.");
assert(/recordAuthorizedDecision/.test(terminalDecision),"Precondition failed: #417 durable terminal decision owner missing.");
assert(/applyPolicyAuthorizedTerminalDisposition/.test(terminalProduction),"Precondition failed: #419 terminal production executor missing.");

const excluded=[moderation,admin,operations,mutationControl].join("\n");
assert(!/applyPolicyAuthorizedTerminalDisposition/.test(excluded),"Existing excluded legacy/dormant surface unexpectedly owns terminal policy invocation.");

/*
 * #419 intentionally instantiates the terminal decision store and terminal executor
 * inside server.js and proves their methods exist. That is downstream composition,
 * not an upstream policy decision.
 *
 * A genuine policy ingress must be a distinct production authority surface which:
 *   1. receives/derives policy approval from a policy-owned trust boundary;
 *   2. constructs or accepts the immutable policy decision provenance;
 *   3. invokes applyPolicyAuthorizedTerminalDisposition as an action, rather than
 *      merely checking that the method exists.
 *
 * Therefore server.js construction/type checks cannot satisfy this court.
 */
const compositionOnly =
  /createMovieMentorTerminalDispositionDecisionMongoStore\(\)/.test(server) &&
  /createMovieMentorTerminalDispositionProductionAuthority\(/.test(server) &&
  /typeof terminalDispositionAuthority\?\.applyPolicyAuthorizedTerminalDisposition!==["']function["']/.test(server);

assert(compositionOnly,"Precondition failed: #419 production composition/readiness proof is no longer recognizable; review the court before classifying policy ingress.");

const serverWithoutCompositionProof=server
  .replace(/const terminalDecisionStore=createMovieMentorTerminalDispositionDecisionMongoStore\(\),terminalDispositionAuthority=createMovieMentorTerminalDispositionProductionAuthority\(\{decisionStore:terminalDecisionStore,settlementAuthority:settlementComposition\.authority\}\);if\(typeof terminalDecisionStore\.recordAuthorizedDecision!==["']function["']\|\|typeof terminalDecisionStore\.resolveAuthorizedDecision!==["']function["']\|\|typeof terminalDispositionAuthority\?\.applyPolicyAuthorizedTerminalDisposition!==["']function["']\)\{[^}]*\}/g,"")
  .replace(/internal policy-owned terminal disposition authority/g,"");

const liveInvocation =
  /\.applyPolicyAuthorizedTerminalDisposition\s*\(\s*\{/.test(serverWithoutCompositionProof);

const livePolicyIssuer =
  /movie-mentor-enforcement|creator-policy-authority|createMovieMentorPolicyDecisionIngressAuthority|createMovieMentorPolicyDecisionIssuerAuthority/.test(serverWithoutCompositionProof);

assert(
  livePolicyIssuer && liveInvocation,
  "RED: #419 composes and type-checks the terminal executor, but no distinct live Movie Mentor policy-decision ingress/issuer is wired to originate policy authority and invoke applyPolicyAuthorizedTerminalDisposition."
);

console.log("GREEN: a distinct live production Movie Mentor policy-decision ingress/issuer is wired beyond #419 composition and invokes the certified terminal executor.");
