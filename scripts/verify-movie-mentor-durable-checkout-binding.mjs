import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createMovieMentorCommercialCheckoutInitiationAuthority } from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const principalId = "creator_17";
const commercialIntentId = "ci_catastrophe_17";
const provider = "stripe";
const checkoutReference = "cs_same_session";
const checkoutUrl = "https://checkout.example/same";
const intent = Object.freeze({
  commercialIntentId,
  principalId,
  packageId: "launch",
  provider,
  providerProductId: "price_server_owned",
  amountMinor: 1000,
  currency: "GBP",
  environment: "test",
  units: 10,
  policyVersion: "v1",
  policyDigest: "digest",
  status: "created",
});

// Catastrophe A: provider success followed by durable completion failure may not
// fabricate completion. Current authority must reauthorize the principal before
// dispatch and revoke the newly-created charge-capable provider checkout when
// durable binding cannot certify it.
let durable = null;
let providerCalls = 0;
let revokeCalls = 0;
let completeCalls = 0;
const failingStore = {
  async begin({ commercialIntentId: id, provider: actualProvider, idempotencyKey }) {
    if (!durable) durable = { commercialIntentId: id, provider: actualProvider, idempotencyKey, status: "pending", checkoutReference: null, checkoutUrl: null, expiresAt: null };
    assert.equal(durable.idempotencyKey, `movie-mentor:${commercialIntentId}`);
    return Object.freeze({ ...durable });
  },
  async complete() {
    completeCalls += 1;
    throw Object.assign(new Error("simulated crash before durable completion"), { code: "MOVIE_MENTOR_CHECKOUT_BINDING_AUTHORITY_UNAVAILABLE" });
  },
  async resolve() { return durable ? Object.freeze({ ...durable }) : null; },
};
const catastropheAuthority = createMovieMentorCommercialCheckoutInitiationAuthority({
  resolvePurchaseIntent: async () => intent,
  createProviderCheckout: async ({ intent: providerIntent, idempotencyKey }) => {
    providerCalls += 1;
    assert.equal(providerIntent.commercialIntentId, commercialIntentId);
    assert.equal(idempotencyKey, `movie-mentor:${commercialIntentId}`);
    return Object.freeze({ authorized: true, commercialIntentId, provider, checkoutReference, checkoutUrl, expiresAt: null });
  },
  revokeProviderCheckout: async ({ provider: actualProvider, checkoutReference: actualReference }) => {
    assert.equal(actualProvider, provider);
    assert.equal(actualReference, checkoutReference);
    revokeCalls += 1;
    return Object.freeze({ revoked: true, provider: actualProvider, checkoutReference: actualReference, status: "expired" });
  },
  checkoutBindingStore: failingStore,
});
await assert.rejects(
  () => catastropheAuthority.initiateCheckout({
    principalId,
    commercialIntentId,
    currentPrincipalAuthority: async () => ({ principalId }),
  }),
  (error) => error?.code === "MOVIE_MENTOR_CHECKOUT_BINDING_AUTHORITY_UNAVAILABLE",
);
assert.equal(durable.status, "pending", "Provider-success/durable-failure must leave pending uncertainty, not fabricated completion.");
assert.equal(providerCalls, 1, "The catastrophe must create exactly one provider checkout.");
assert.equal(completeCalls, 1, "The catastrophe must attempt durable completion exactly once.");
assert.equal(revokeCalls, 1, "Uncertified provider success must be revoked before authority returns failure.");

// Catastrophe B: a separately certified completed durable binding may recover
// only through current provider reality and must suppress a duplicate provider
// side effect.
let recoveryProviderCalls = 0;
let providerRealityReads = 0;
const completed = Object.freeze({
  commercialIntentId,
  provider,
  idempotencyKey: `movie-mentor:${commercialIntentId}`,
  status: "completed",
  checkoutReference,
  checkoutUrl,
  expiresAt: null,
});
const recoveryAuthority = createMovieMentorCommercialCheckoutInitiationAuthority({
  resolvePurchaseIntent: async () => intent,
  createProviderCheckout: async () => {
    recoveryProviderCalls += 1;
    throw new Error("completed durable reality must suppress provider dispatch");
  },
  resolveProviderCheckout: async ({ provider: actualProvider, checkoutReference: actualReference }) => {
    providerRealityReads += 1;
    assert.equal(actualProvider, provider);
    assert.equal(actualReference, checkoutReference);
    return Object.freeze({ provider, checkoutReference, checkoutUrl, status: "open" });
  },
  checkoutBindingStore: {
    async begin() { return completed; },
    async complete() { throw new Error("completed recovery must not rewrite durable binding"); },
    async resolve() { return completed; },
  },
});
const recovered = await recoveryAuthority.initiateCheckout({ principalId, commercialIntentId });
assert.equal(recovered.recovered, true);
assert.equal(recovered.checkoutReference, checkoutReference);
assert.equal(recovered.checkoutUrl, checkoutUrl);
assert.equal(providerRealityReads, 1, "Completed history must regain authority through current provider reality.");
assert.equal(recoveryProviderCalls, 0, "Completed durable binding must suppress another provider side effect.");

const storeSource = await fs.readFile(new URL("../ai/MovieMentorCommercialCheckoutBindingMongoStore.js", import.meta.url), "utf8");
const composition = await fs.readFile(new URL("../ai/MovieMentorProductionCommercialCheckoutComposition.js", import.meta.url), "utf8");
const registry = await fs.readFile(new URL("../ai/MovieMentorCommercialCheckoutProviderRegistry.js", import.meta.url), "utf8");
const stripe = await fs.readFile(new URL("../ai/MovieMentorStripeCommercialProviderAdapter.js", import.meta.url), "utf8");
const server = await fs.readFile(new URL("../server.js", import.meta.url), "utf8");
const authoritySource = await fs.readFile(new URL("../ai/MovieMentorCommercialCheckoutInitiationAuthority.js", import.meta.url), "utf8");
assert.match(storeSource, /unique:true/);
assert.match(storeSource, /status:\{type:String,enum:\["pending","completed"\]/);
assert.match(storeSource, /processLocalFallback:false/);
assert.match(composition, /createMovieMentorCommercialCheckoutBindingMongoStore/);
assert.match(registry, /idempotencyKey/);
assert.match(stripe, /key!==`movie-mentor:\$\{id\}`/);
assert.match(authoritySource, /requireCurrentPrincipalAuthority\(principal,currentPrincipalAuthority,"pre-provider-dispatch"\)/, "provider dispatch must retain current-principal reauthorization");
assert.match(authoritySource, /revokeOwnedCheckout\(principal,checkout,error,"binding-completion-failure"\)/, "uncertified provider success must retain revocation authority");
assert.match(authoritySource, /requireRecoveredProviderReality\(binding\)/, "completed durable history must retain current provider-reality proof");
assert.match(server, /app\.use\(commercialMount\.creatorBasePath,commercialMount\.creatorRouter\)/);
const originIndex = server.indexOf("browserOriginAuthority.authorizeRequest");
const creatorIndex = server.indexOf("app.use(commercialMount.creatorBasePath");
assert(originIndex >= 0 && creatorIndex > originIndex, "Creator commercial router must mount behind browser-origin authority.");
console.log("PASS 5A.17: durable checkout binding court now owns current-principal dispatch authority, revocation after uncertified provider success, current provider reality on completed recovery, duplicate-side-effect suppression, and browser-origin composition.");
