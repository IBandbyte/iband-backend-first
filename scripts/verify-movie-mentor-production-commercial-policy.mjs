import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {createMovieMentorCommercialPolicyRegistry} from "../ai/MovieMentorCommercialPolicyRegistry.js";
import {createMovieMentorProductionCommercialPolicyComposition} from "../ai/MovieMentorProductionCommercialPolicyComposition.js";

const p1={packageId:"creator-20",provider:"provider-a",providerProductId:"prod_20",amountMinor:1200,currency:"gbp",environment:"test",units:20,policyVersion:"v1"};
const registry=createMovieMentorCommercialPolicyRegistry({policies:[p1]});
const resolved=await registry.resolveCommercialPolicy({packageId:"creator-20"});
assert.equal(resolved.packageId,"creator-20");assert.equal(resolved.currency,"GBP");assert.equal(resolved.amountMinor,1200);assert.equal(resolved.units,20);assert.equal(resolved.provider,"provider-a");assert.match(resolved.policyDigest,/^[a-f0-9]{64}$/);
const canonical={packageId:"creator-20",provider:"provider-a",providerProductId:"prod_20",amountMinor:1200,currency:"GBP",environment:"test",units:20,policyVersion:"v1"};
assert.equal(resolved.policyDigest,crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex"));
assert.equal(await registry.resolveCommercialPolicy({packageId:"creator-20",provider:"provider-b"}),null);
assert.equal(await registry.resolveCommercialPolicy({packageId:"missing"}),null);
assert.deepEqual(registry.listCommercialPackages(),[{packageId:"creator-20",amountMinor:1200,currency:"GBP",units:20,policyVersion:"v1"}]);

assert.throws(()=>createMovieMentorCommercialPolicyRegistry({policies:[p1,{...p1,providerProductId:"different"}]}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_POLICY_DUPLICATE_PACKAGE");
for(const bad of [{...p1,amountMinor:0},{...p1,units:0},{...p1,currency:"£"},{...p1,provider:""},{...p1,policyVersion:""}])assert.throws(()=>createMovieMentorCommercialPolicyRegistry({policies:[bad]}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_POLICY_INVALID");

const absent=createMovieMentorProductionCommercialPolicyComposition({env:{}});assert.equal(absent.ready,false);assert.equal(absent.reason,"commercial-policy-not-configured");
assert.throws(()=>createMovieMentorProductionCommercialPolicyComposition({env:{MOVIE_MENTOR_COMMERCIAL_POLICY_JSON:"not-json"}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_INVALID");
const configured=createMovieMentorProductionCommercialPolicyComposition({env:{MOVIE_MENTOR_COMMERCIAL_POLICY_JSON:JSON.stringify([p1])}});assert.equal(configured.ready,true);assert.deepEqual(configured.configuredPackageIds,["creator-20"]);assert.equal(configured.creatorMutable,false);
const configuredPolicy=await configured.resolveCommercialPolicy({packageId:"creator-20"});assert.equal(configuredPolicy.units,20);assert.equal(configuredPolicy.amountMinor,1200);

const env=fs.readFileSync(new URL("../.env.example",import.meta.url),"utf8");assert.match(env,/MOVIE_MENTOR_COMMERCIAL_POLICY_JSON=/);assert.match(env,/NOT launch pricing/);assert.match(env,/Creator\/browser payloads may never override/);
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");assert.doesNotMatch(server,/createMovieMentorProductionCommercialPolicyComposition/);

console.log("✓ production commercial policy fails closed when absent or malformed");
console.log("✓ package ids are unique and commercial terms are strictly validated");
console.log("✓ currency is canonicalized and policy snapshots carry deterministic SHA-256 identity");
console.log("✓ provider filtering cannot reinterpret a package onto another provider");
console.log("✓ public package listing excludes provider product identifiers and internal digest");
console.log("✓ .env.example documents shape without committing launch pricing or secrets");
console.log("✓ policy remains unmounted until a real provider composition and launch terms are deliberately configured");
console.log("LAW: creator package choice is reference; server-owned commercial policy is authority");
console.log("5A.13 production commercial policy torture: GREEN");
