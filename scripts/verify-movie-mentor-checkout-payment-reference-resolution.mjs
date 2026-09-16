import assert from "node:assert/strict";
import { createMovieMentorCommercialCheckoutBindingMongoStore } from "../ai/MovieMentorCommercialCheckoutBindingMongoStore.js";

console.log("Movie Mentor checkout payment-reference resolution verifier");

const indexes = [
  { key: { commercialIntentId: 1 }, unique: true },
  { key: { provider: 1, checkoutReference: 1 }, unique: true, partialFilterExpression: { checkoutReference: { $type: "string" } } },
  { key: { provider: 1, providerPaymentReference: 1 }, unique: true, partialFilterExpression: { providerPaymentReference: { $type: "string" } } },
];

const rows = [
  { domain: "iband.movie-mentor.commercial-checkout-binding", schema: 1, commercialIntentId: "intent-owned", provider: "stripe", idempotencyKey: "key-owned", status: "completed", checkoutReference: "cs-owned", checkoutUrl: "https://checkout.example/owned", providerPaymentReference: "pi-owned", createdAtAuthority: new Date("2035-01-01T00:00:00.000Z"), completedAtAuthority: new Date("2035-01-01T00:01:00.000Z"), paymentBoundAtAuthority: new Date("2035-01-01T00:02:00.000Z") },
  { domain: "iband.movie-mentor.commercial-checkout-binding", schema: 1, commercialIntentId: "intent-other-provider", provider: "provider-b", idempotencyKey: "key-other", status: "completed", checkoutReference: "checkout-other", checkoutUrl: "https://checkout.example/other", providerPaymentReference: "pi-owned", createdAtAuthority: new Date("2035-01-01T00:00:00.000Z"), completedAtAuthority: new Date("2035-01-01T00:01:00.000Z") },
  { domain: "iband.movie-mentor.commercial-checkout-binding", schema: 1, commercialIntentId: "intent-pending", provider: "stripe", idempotencyKey: "key-pending", status: "pending", checkoutReference: null, checkoutUrl: null, providerPaymentReference: "pi-pending", createdAtAuthority: new Date("2035-01-01T00:00:00.000Z") },
];

let findOneCalls = 0;
const model = {
  async init() {},
  collection: { async indexes() { return indexes; } },
  findOne(filter) {
    findOneCalls += 1;
    return { lean() { return this; }, async exec() { return rows.find(row => Object.entries(filter).every(([key, value]) => row[key] === value)) ?? null; } };
  },
};

const store = createMovieMentorCommercialCheckoutBindingMongoStore({ modelRef: model });

const direct = await store.resolveByProviderPaymentReference({ provider: " stripe ", providerPaymentReference: " pi-owned " });
assert.equal(findOneCalls, 1);
assert.equal(direct?.commercialIntentId, "intent-owned");
assert.equal(direct?.provider, "stripe");
assert.equal(direct?.providerPaymentReference, "pi-owned");
assert.equal(direct?.status, "completed");

const alias = await store.resolveByProviderPaymentReference({ provider: "stripe", paymentReference: "pi-owned" });
assert.equal(alias?.commercialIntentId, "intent-owned");

const wrongProvider = await store.resolveByProviderPaymentReference({ provider: "provider-c", providerPaymentReference: "pi-owned" });
assert.equal(wrongProvider, null);

const pending = await store.resolveByProviderPaymentReference({ provider: "stripe", providerPaymentReference: "pi-pending" });
assert.equal(pending, null);

const missingIdentity = await store.resolveByProviderPaymentReference({ provider: "stripe", providerPaymentReference: "   " });
assert.equal(missingIdentity, null);
assert.equal(findOneCalls, 4, "blank payment identity must not query durable state");

console.log("GREEN: real checkout binding store resolves only exact completed provider-payment lineage.");
