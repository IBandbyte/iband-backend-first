import assert from "node:assert/strict";
import {createMovieMentorCommercialPurchaseIntentMongoStore} from "../ai/MovieMentorCommercialPurchaseIntentMongoStore.js";

const legacy=Object.freeze({
 domain:"iband.movie-mentor.commercial-purchase-intent",
 schema:1,
 commercialIntentId:"intent-schema1-live-1",
 principalId:"creator-schema1",
 packageId:"creator-20",
 provider:"provider-a",
 providerProductId:"prod-20",
 amountMinor:2000,
 currency:"GBP",
 environment:"live",
 units:20,
 policyVersion:"v1",
 policyDigest:"digest-v1",
 status:"created",
 createdAtAuthority:new Date("2030-01-01T00:00:00.000Z")
});
let queries=[];
const modelRef={
 findOne(query){
  queries.push(query);
  return {lean(){return {exec:async()=>query.commercialIntentId===legacy.commercialIntentId&&query.schema===1?legacy:null};}};
 }
};
const store=createMovieMentorCommercialPurchaseIntentMongoStore({modelRef});
const resolved=await store.resolve({commercialIntentId:legacy.commercialIntentId});
assert.ok(resolved,"a still-live purchase intent minted under the previous durable schema must remain resolvable after schema upgrade");
assert.equal(resolved.commercialIntentId,legacy.commercialIntentId);
assert.equal(resolved.principalId,legacy.principalId);
assert.equal(resolved.packageId,legacy.packageId);
assert.equal(resolved.status,"created");
assert.ok(queries.some(query=>query.schema===1),"historical resolution must deliberately search the prior durable schema rather than silently orphaning it");
console.log("purchase-intent historical-schema authority torture: GREEN");
console.log("LAW: DURABLE COMMERCIAL AUTHORITY SURVIVES A SCHEMA UPGRADE; ADDING RETRY-IDEMPOTENCY METADATA MUST NOT ORPHAN STILL-LIVE PURCHASE INTENTS MINTED UNDER THE PREVIOUS SCHEMA.");
