import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor unbound-release ↔ execution-binding race court");

const execution = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js", import.meta.url), "utf8");
const settlement = fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js", import.meta.url), "utf8");

const executionCreate = execution.slice(execution.indexOf("async function createExecution"), execution.indexOf("async function replaceExecution"));
const releaseStart = settlement.indexOf("async function releaseUnboundReservation");
const releaseEnd = settlement.indexOf("async function compensateSupersededCreatorState", releaseStart);
const unboundRelease = settlement.slice(releaseStart, releaseEnd);

assert.ok(executionCreate.includes("session.withTransaction"), "RED: durable execution binding must be transactional.");
assert.ok(executionCreate.includes("reservationLedger().findOne"), "RED: execution creation must read the reservation inside its transaction.");
assert.ok(executionCreate.includes("status:\"reserved\""), "RED: execution creation must require the reservation to remain reserved.");
assert.ok(executionCreate.includes("executionBindingBarrierRevision:1"), "RED: execution creation must write the shared reservation row so a concurrent release cannot commit from a stale absence belief.");

assert.ok(unboundRelease.includes("session.withTransaction"), "RED: unbound release must be transactional.");
assert.ok(unboundRelease.includes("executions.findOne({reservationId:id}"), "RED: unbound release must test durable execution binding inside its transaction.");
assert.ok(unboundRelease.includes("reservation-already-bound-to-execution"), "RED: a visible execution binding must deny release.");
assert.ok(unboundRelease.includes("reservations.findOneAndUpdate({reservationId:id,principalId:principal,projectId:project,status:\"reserved\"}"), "RED: release must write the same reserved reservation row used as execution creation's serialization barrier.");

const executionBarrier = executionCreate.indexOf("executionBindingBarrierRevision:1");
const executionInsert = executionCreate.indexOf("storeModel().create([next]");
assert.ok(executionBarrier >= 0 && executionInsert > executionBarrier, "RED: execution creation must establish the reservation write barrier before inserting the execution.");

const releaseExecutionRead = unboundRelease.indexOf("executions.findOne({reservationId:id}");
const releaseReservationWrite = unboundRelease.indexOf("reservations.findOneAndUpdate({reservationId:id,principalId:principal,projectId:project,status:\"reserved\"}");
assert.ok(releaseExecutionRead >= 0 && releaseReservationWrite > releaseExecutionRead, "RED: unbound release must test execution absence before its reservation write barrier.");

console.log("GREEN: execution binding and unbound release both cross the same reserved reservation document inside majority transactions; neither can commit commercial authority from an unserialized process-local absence belief.");
console.log("LAW: EXECUTION BINDING AND UNBOUND CREDIT RESTORATION ARE MUTUALLY EXCLUSIVE DURABLE OUTCOMES; BOTH MUST SERIALIZE THROUGH THE SAME RESERVED RESERVATION ROW.");
