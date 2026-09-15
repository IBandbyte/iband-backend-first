import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Checkout revocation batch-failure authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialCheckoutComposition.js",import.meta.url),"utf8");
const start=source.indexOf("async function revokeOpenCheckoutsForPrincipal");
const end=source.indexOf("\n const status=checkoutStatus",start);
assert.ok(start>=0&&end>start,"court must locate the exact production checkout-revocation implementation");
const functionSource=source.slice(start,end).trim();

const principalId="creator-batch-failure";
const candidates=Object.freeze([
  Object.freeze({commercialIntentId:"intent-conflict",provider:"stripe",checkoutReference:"checkout-conflict"}),
  Object.freeze({commercialIntentId:"intent-open-2",provider:"stripe",checkoutReference:"checkout-open-2"}),
  Object.freeze({commercialIntentId:"intent-open-3",provider:"stripe",checkoutReference:"checkout-open-3"}),
]);
const intents=new Map(candidates.map(binding=>[binding.commercialIntentId,Object.freeze({commercialIntentId:binding.commercialIntentId,principalId})]));
const attempts=[];
const checkoutBindingStore=Object.freeze({async listUnpaidCompleted(){return candidates;}});
const purchaseIntentAuthority=Object.freeze({async resolvePurchaseIntent({commercialIntentId}){return intents.get(commercialIntentId)||null;}});
const registry=Object.freeze({
  async revokeProviderCheckout({provider,checkoutReference}){
    assert.equal(provider,"stripe");
    attempts.push(checkoutReference);
    if(checkoutReference==="checkout-conflict"){
      const error=new Error("provider says payment authority may already exist");
      error.code="MOVIE_MENTOR_STRIPE_CHECKOUT_REVOCATION_CONFLICT";
      throw error;
    }
    return Object.freeze({revoked:true,provider,checkoutReference});
  }
});
function fail(code,message){const error=new Error(message);error.code=code;throw error;}

const revokeOpenCheckoutsForPrincipal=new Function(
  "checkoutBindingStore","purchaseIntentAuthority","registry","fail",
  `return (${functionSource});`,
)(checkoutBindingStore,purchaseIntentAuthority,registry,fail);

let thrown=null;
try{await revokeOpenCheckoutsForPrincipal({principalId});}catch(error){thrown=error;}
assert.equal(thrown?.code,"MOVIE_MENTOR_STRIPE_CHECKOUT_REVOCATION_CONFLICT","court requires one candidate to become non-revocable because payment authority may already exist");
assert.deepEqual(
  attempts,
  ["checkout-conflict","checkout-open-2","checkout-open-3"],
  "one conflicting checkout must not abort revocation attempts for later still-charge-capable sessions belonging to the same suspended principal",
);
console.log("PASS one checkout revocation conflict cannot shield later charge-capable sessions in the same principal batch");
console.log("LAW: ONE CHECKOUT MAY HAVE CROSSED INTO PAYMENT REALITY; IT MAY NOT LEND SURVIVAL AUTHORITY TO ITS OPEN SIBLINGS.");
