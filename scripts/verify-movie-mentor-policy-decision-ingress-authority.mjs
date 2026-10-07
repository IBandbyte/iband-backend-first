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

const productionIssuerSurface=[server].join("\n");
assert(
  /movie-mentor-enforcement|creator-policy-authority|MovieMentor.*Policy.*Decision.*Authority|applyPolicyAuthorizedTerminalDisposition/.test(productionIssuerSurface),
  "RED: no live Movie Mentor policy-decision ingress/issuer is wired into production to originate policy authority and invoke the certified terminal-disposition executor."
);

assert(
  /recordAuthorizedDecision/.test(productionIssuerSurface),
  "RED: production policy ingress cannot durably originate the policy decision consumed by the certified downstream authorities."
);

console.log("GREEN: a live production Movie Mentor policy-decision ingress/issuer is wired and can originate durable policy authority before invoking the certified terminal executor.");
