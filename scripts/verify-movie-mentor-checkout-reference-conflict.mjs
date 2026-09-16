import assert from "node:assert/strict";
import { createMovieMentorCommercialCheckoutBindingMongoStore } from "../ai/MovieMentorCommercialCheckoutBindingMongoStore.js";

console.log("Movie Mentor checkout-reference conflict verifier");

const indexes = [
  { key: { commercialIntentId: 1 }, unique: true },
  { key: { provider: 1, checkoutReference: 1 }, unique: true, partialFilterExpression: { checkoutReference: { $type: "string" } } },
  { key: { provider: 1, providerPaymentReference: 1 }, unique: true, partialFilterExpression: { providerPaymentReference: { $type: "string" } } },
];

const existingOwner = {
  domain: "iband.movie-mentor.commercial-checkout-binding", schema: 1,
  commercialIntentId: "intent-owner", provider: "stripe", idempotencyKey: "key-owner",
  status: "completed", checkoutReference: "cs-shared", checkoutUrl: "https://checkout.example/owner",
  providerPaymentReference: null, createdAtAuthority: new Date("2035-01-01T00:00:00.000Z"),
  completedAtAuthority: new Date("2035-01-01T00:01:00.000Z")
};
const competing = {
  domain: "iband.movie-mentor.commercial-checkout-binding", schema: 1,
  commercialIntentId: "intent-competing", provider: "stripe", idempotencyKey: "key-competing",
  status: "pending", checkoutReference: null, checkoutUrl: null, providerPaymentReference: null,
  createdAtAuthority: new Date("2035-01-01T00:00:00.000Z")
};
const rows = [structuredClone(existingOwner), structuredClone(competing)];
let updateCalls = 0;

const query = result => ({ lean() { return this; }, async exec() { return result; } });
const model = {
  async init() {},
  collection: { async indexes() { return indexes; } },
  findOneAndUpdate(filter, update) {
    updateCalls += 1;
    const row = rows.find(r => r.commercialIntentId === filter.commercialIntentId && r.provider === filter.provider && r.idempotencyKey === filter.idempotencyKey && r.status === filter.status);
    if (!row) return query(null);
    const desired = update?.$set?.checkoutReference;
    if (rows.some(r => r !== row && r.provider === row.provider && r.checkoutReference === desired)) {
      const error = new Error("duplicate provider checkout reference");
      error.code = 11000;
      return { lean() { return this; }, async exec() { throw error; } };
    }
    Object.assign(row, update.$set);
    return query(row);
  },
  findOne(filter) {
    return query(rows.find(row => Object.entries(filter).every(([key, value]) => row[key] === value)) ?? null);
  },
};

const store = createMovieMentorCommercialCheckoutBindingMongoStore({ modelRef: model, now: () => new Date("2035-01-01T00:02:00.000Z") });
let caught = null;
try {
  await store.complete({ commercialIntentId: "intent-competing", provider: "stripe", idempotencyKey: "key-competing", checkoutReference: "cs-shared", checkoutUrl: "https://checkout.example/competing" });
} catch (error) { caught = error; }

assert.equal(updateCalls, 1);
assert.equal(caught?.code, "MOVIE_MENTOR_CHECKOUT_BINDING_PROVIDER_REFERENCE_CONFLICT");
assert.equal(rows[0].commercialIntentId, "intent-owner");
assert.equal(rows[0].checkoutReference, "cs-shared");
assert.equal(rows[1].status, "pending");
assert.equal(rows[1].checkoutReference, null);
assert.equal(rows[1].checkoutUrl, null);

console.log("GREEN: real checkout binding store rejects duplicate provider checkout-reference ownership without changing either binding.");
