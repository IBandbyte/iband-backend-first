import assert from "node:assert/strict";
import {createMovieMentorCommercialPolicyRegistry} from "../ai/MovieMentorCommercialPolicyRegistry.js";
import {createMovieMentorProductionCommercialPolicyComposition} from "../ai/MovieMentorProductionCommercialPolicyComposition.js";

const policies=[{packageId:"creator-20",provider:"stripe",providerProductId:"prod-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"}];

assert.throws(()=>createMovieMentorCommercialPolicyRegistry({policies}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_SOURCE_REQUIRED");
const registry=createMovieMentorCommercialPolicyRegistry({policies,configurationSource:"MOVIE_MENTOR_COMMERCIAL_POLICY_JSON"});
assert.equal(typeof registry.catalogueAuthority?.listCommercialPackages,"function");
assert.equal(typeof registry.catalogueAuthority?.getStatus,"function");
const owned=registry.catalogueAuthority.getStatus();
assert.equal(owned.domain,"iband.movie-mentor.production-commercial-package-catalogue-authority");
assert.equal(owned.production,true);
assert.equal(owned.serverOwned,true);
assert.equal(owned.creatorMutable,false);
assert.equal(owned.immutableSnapshotRequired,true);
assert.equal(owned.configurationSource,"MOVIE_MENTOR_COMMERCIAL_POLICY_JSON");
assert.equal(owned.processLocalFallback,false);

const composition=createMovieMentorProductionCommercialPolicyComposition({env:{MOVIE_MENTOR_COMMERCIAL_POLICY_JSON:JSON.stringify(policies)}});
assert.equal(composition.ready,true);
assert.equal(composition.catalogueAuthority,composition.authority.catalogueAuthority);
assert.deepEqual(composition.catalogueStatus,composition.catalogueAuthority.getStatus());
assert.equal(composition.catalogueStatus.domain,"iband.movie-mentor.production-commercial-package-catalogue-authority");
assert.equal(composition.catalogueStatus.processLocalFallback,false);
assert.deepEqual(await composition.catalogueAuthority.listCommercialPackages(),[{packageId:"creator-20",amountMinor:2000,currency:"GBP",units:20,policyVersion:"v1"}]);

console.log("✓ commercial policy registry owns package-catalogue capability proof");
console.log("✓ composition consumes the exact registry-owned catalogue authority without manufacturing a wrapper");
console.log("✓ composition status matches the owner proof semantically without requiring repeated getStatus calls to return the same object identity");
console.log("✓ absent configuration-source ownership grants zero catalogue authority");
console.log("LAW: POLICY REGISTRY PROOF → CATALOGUE AUTHORITY → CREATOR GATEWAY. PROOF DOES NOT TELEPORT.");
console.log("Round Seven commercial package catalogue provenance torture: GREEN");
