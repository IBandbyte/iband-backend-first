import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendAuthority } from "../ai/MovieMentorInferenceSpendAuthority.js";

console.log("Movie Mentor pre-execution reservation acknowledgement-loss authority court");

const serverAuthority = Object.freeze({
  authenticated: true,
  projectAuthorized: true,
  principalId: "creator-pre-ack",
  projectId: "project-pre-ack",
});

const rows = new Map();
let remaining = 2;
let nextReservation = 0;
let durableReserveCalls = 0;

const store = {
  async reserve(request) {
    durableReserveCalls += 1;
    const existing = rows.get(request.reservationId);
    if (existing) return { granted: true, reservation: structuredClone(existing), idempotent: true };
    if (remaining < request.units) return { granted: false, reason: "insufficient-capacity" };
    remaining -= request.units;
    const reservation = { ...request, status: "reserved", entitlementRevision: 1 };
    rows.set(request.reservationId, structuredClone(reservation));
    return { granted: true, reservation: structuredClone(reservation), idempotent: false };
  },
  async readReservation(reservationId) {
    const row = rows.get(reservationId);
    return row ? structuredClone(row) : null;
  },
};

const authority = createMovieMentorInferenceSpendAuthority({
  store,
  createReservationId: () => `reservation-${++nextReservation}`,
});

// Transport attempt one: durable reservation commits, but the caller never receives
// the successful return value. No execution row can therefore be opened or bound.
const first = await authority.reserveTurn({ serverAuthority, projectId: "project-pre-ack" });
assert.equal(first.reservationId, "reservation-1");
assert.equal(rows.size, 1);
assert.equal(remaining, 1);

// Model acknowledgement loss by intentionally discarding `first`. The retry has only
// the same creator/project/turn meaning; reserveTurn receives no creatorTurnId or prior
// reservation identity from which to recover reservation-1.
const retry = await authority.reserveTurn({ serverAuthority, projectId: "project-pre-ack" });

assert.equal(retry.reservationId, "reservation-1", "same creator-turn retry must recover the already-committed reservation rather than mint a second economic identity");
assert.equal(rows.size, 1, "acknowledgement loss before execution binding must not leave two live reservations for one creator action");
assert.equal(remaining, 1, "retry must not reserve a second unit for the same creator action");
assert.equal(durableReserveCalls, 2, "the retry may revisit durable reservation authority, but must do so idempotently against the same economic identity");

console.log("GREEN: a committed reservation whose acknowledgement is lost before execution binding is recovered idempotently by the same creator-turn retry.");
console.log("LAW: ONE CREATOR ACTION MAY OWN ONLY ONE DURABLE RESERVATION EVEN WHEN THE FIRST RESERVATION RESPONSE IS LOST BEFORE EXECUTION BINDING.");
