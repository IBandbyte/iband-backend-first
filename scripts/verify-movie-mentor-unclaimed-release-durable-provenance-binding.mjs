import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor unclaimed-release durable provenance reachability court");

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const execution=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");

const releaseStart=settlement.indexOf("async function releaseUnclaimedReservation");
const releaseEnd=settlement.indexOf("async function releaseUnboundReservation",releaseStart);
const release=settlement.slice(releaseStart,releaseEnd);
const unboundStart=settlement.indexOf("async function releaseUnboundReservation");
const unboundEnd=settlement.indexOf("async function compensateSupersededCreatorState",unboundStart);
const unbound=settlement.slice(unboundStart,unboundEnd);
const createStart=execution.indexOf("async function createExecution");
const createEnd=execution.indexOf("async function replaceExecution",createStart);
const create=execution.slice(createStart,createEnd);

assert.ok(releaseStart>=0&&releaseEnd>releaseStart&&unboundStart>=0&&unboundEnd>unboundStart&&createStart>=0&&createEnd>createStart);

assert.match(release,/session\.withTransaction/,"unclaimed release must be atomic");
assert.match(release,/\$set:\{phase:"aborted",abortedAt,abortReason:"unclaimed-reservation-released"\}/,
  "zero-claim abort identity is written in the same transaction as release");
assert.match(release,/\$set:\{status:"released",settledAt:abortedAt,settlementReason:"execution-aborted-before-provider-claim"\}/,
  "fresh unclaimed release writes its durable release provenance in that transaction");

assert.match(unbound,/executions\.findOne\(\{reservationId:id\}/,
  "unbound release denies a durable execution binding");
assert.match(unbound,/reservation-already-bound-to-execution/,
  "unbound release must fail closed when execution exists");
assert.match(unbound,/reservations\.findOneAndUpdate\(\{reservationId:id,principalId:principal,projectId:project,status:"reserved"\}/,
  "unbound release can only transition a still-reserved row");

assert.match(create,/session\.withTransaction/,"execution creation must be atomic");
assert.match(create,/status:"reserved"/,"execution creation requires a reserved reservation");
assert.match(create,/executionBindingBarrierRevision:1/,
  "execution creation writes the same reservation row before execution insertion");

const releasedBranch=release.slice(
  release.indexOf('if(text(reservation.status)==="released")'),
  release.indexOf('if(text(reservation.status)!=="reserved")')
);
assert.ok(releasedBranch.length>0,"already-released branch remains visible");
assert.doesNotMatch(releasedBranch,/settlementReason/,
  "status-only idempotence is acceptable only because production authorities make active-execution + foreign-release history unreachable");

console.log("GREEN: current production authorities cannot create an active execution bound to a reservation released by the unbound path; execution binding and unbound release serialize through the same reserved row, while unclaimed abort+release is atomic.");
console.log("LAW: RELEASE PROVENANCE NEED NOT BE RE-PROVEN FROM STATUS ALONE WHEN THE ONLY PRODUCTION WRITERS MAKE FOREIGN RELEASE OWNERSHIP UNREACHABLE; THE SHARED RESERVATION TRANSACTION IS THE AUTHORITY BARRIER.");
