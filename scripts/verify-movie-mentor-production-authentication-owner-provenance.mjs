import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorProductionAuthenticationComposition} from "../ai/MovieMentorProductionAuthenticationComposition.js";

console.log("ROUND EIGHT — production authentication owner provenance torture");

const verifyCredential=async()=>Object.freeze({verified:true,principalId:"creator-1"});
const verifier=Object.freeze({version:"1.0.0",domain:"iband.movie-mentor.journey-recovery-clerk-credential-verifier",provider:"clerk",algorithm:"RS256",networkMode:"pinned-public-key",authorizedParties:Object.freeze(["https://app.example.com"]),verifyCredential});
const env={MOVIE_MENTOR_CLERK_JWT_KEY:"PUBLIC",MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:'["https://app.example.com"]',MOVIE_MENTOR_CLERK_ISSUER:"https://issuer.example.com",MOVIE_MENTOR_AUDIENCE:"movie-mentor"};
const composition=createMovieMentorProductionAuthenticationComposition({env,createVerifier:()=>verifier});
assert.equal(composition.ready,true);
assert.equal(typeof composition.getStatus,"function");
const status=composition.getStatus();
assert.equal(status,composition.status);
assert.equal(composition.getStatus(),status);
assert.equal(Object.isFrozen(status),true);
assert.equal(status.domain,"iband.movie-mentor.production-authentication-composition");
assert.equal(status.ownerBoundAuthentication,true);
assert.equal(status.verifier,composition.verifier);
assert.equal(status.verifier,verifier);
assert.equal(status.verifyCredential,composition.verifyCredential);
assert.equal(status.expectedIssuer,composition.expectedIssuer);
assert.equal(status.expectedAudience,composition.expectedAudience);
assert.equal(status.processLocalFallback,false);
const reconstructed=Object.freeze({...status});
assert.deepEqual(reconstructed,status);
assert.notEqual(reconstructed,status);
const lookalike=Object.freeze({...composition,status:reconstructed,getStatus:()=>reconstructed});
assert.notEqual(lookalike.getStatus(),composition.status);

const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const commercial=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
assert.match(server,/authenticationStatus=typeof authentication\?\.getStatus===\"function\"\?authentication\.getStatus\(\):null/);
assert.match(server,/status===composition\?\.status/);
assert.match(server,/authenticationCompositionProven\(authentication,authenticationStatus\)/);
assert.match(server,/production-authentication-owner-proof-not-proven/);
assert.ok(server.indexOf("authenticationCompositionProven(authentication,authenticationStatus)")<server.indexOf('app.use("/api/movie-mentor", router)'),"authentication owner proof must be consumed before creator HTTP mount");
assert.match(commercial,/authenticationStatus=ownedStatus\(authentication\)/);
assert.match(commercial,/s===c\?\.status/);
assert.match(commercial,/authenticationProven\(authentication,authenticationStatus\)/);
assert.match(commercial,/production-authentication-owner-proof-not-proven/);
assert.ok(commercial.indexOf("authenticationProven(authentication,authenticationStatus)")<commercial.indexOf("app.post(STRIPE_WEBHOOK_PATH"),"authentication owner proof must be consumed before commercial HTTP registration");

console.log("✓ production authentication owns one stable immutable status proof");
console.log("✓ exact verifier, credential method, issuer and audience lineage cross by reference/value binding");
console.log("✓ reconstructed deep-equal authentication proof receives zero HTTP authority");
console.log("LAW: VERIFIER CAPABILITY → AUTHENTICATION OWNER PROOF → HTTP BOUNDARY → ROUTE");
console.log("🐔 Zorg: ‘But my clone is deepEqual.’  ⚔️ Codex: ‘IT IS NOT THE OWNER’S PROOF, ZORG.’");
console.log("ROUND EIGHT authentication owner provenance: GREEN");
