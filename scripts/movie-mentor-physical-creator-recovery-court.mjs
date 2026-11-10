import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { readAuthoritativeTurnSource } from "../ai/MovieMentorCreatorStateStore.js";
import { createMovieMentorProjectOwnershipAuthority, MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN, MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA } from "../ai/MovieMentorProjectOwnershipRegistry.js";
import { createMovieMentorCreatorStateReadAuthority } from "../ai/MovieMentorCreatorStateReadAuthority.js";
import { createMovieMentorProductionAuthenticationComposition } from "../ai/MovieMentorProductionAuthenticationComposition.js";
import { createMovieMentorCreatorStateRecoveryProductionComposition } from "../ai/MovieMentorCreatorStateRecoveryProductionComposition.js";

// Physical Mongo stage only. Test fixtures are isolated, never production.
// This stage must not claim signed HTTP or owner-bound recovery certification.
export async function runMovieMentorPhysicalCreatorRecoveryCourt() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27017\//.test(uri)) {
    throw new Error("RED PHYSICAL PREFLIGHT: isolated loopback Mongo URI required");
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, "rs0", "RED: actual rs0 required");
    assert.equal(hello.isWritablePrimary, true, "RED: writable PRIMARY required");
    console.log("GREEN PHYSICAL MONGO: loopback replica-set PRIMARY verified");
    const db = mongoose.connection.db;
    const states = db.collection("movie_mentor_creator_state");
    await states.createIndex({ projectId: 1 }, {
      unique: true, partialFilterExpression: { projectId: { $type: "string" } },
    });
    const projectId = "physical-recovery-isolated-project";
    await states.insertOne({
      projectId, revision: 1, creatorStateGeneration: 1,
      revisionAuthorityReference: "isolated-revision",
      creatorStateFingerprint: "isolated-fingerprint",
      creatorAuthorityReference: "isolated-creator-authority",
      snapshotReference: "isolated-snapshot",
      creatorConfirmedContext: [],
      capturedAt: new Date(),
    });
    const before = await states.findOne({ projectId });
    const state = await readAuthoritativeTurnSource({ projectId });
    assert.equal(state.projectId, projectId);
    assert.equal(state.revision, 1);
    assert.equal(state.creatorStateGeneration, 1);
    const after = await states.findOne({ projectId });
    assert.deepEqual(after, before, "RED: authoritative read mutated durable state");
    console.log("GREEN PHYSICAL MONGO: real indexed authoritative creator-state read and immutability");
    const ownership = db.collection("movie_mentor_project_ownership");
    await ownership.createIndex({ projectId: 1 }, { unique: true });
    await ownership.createIndex({ establishmentAuthorityId: 1 }, { unique: true });
    await ownership.insertOne({
      domain: MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN,
      schema: MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA,
      projectId, ownerPrincipalId: "physical-owner",
      ownershipRevision: 1, ownershipReference: "physical-owner-reference",
      establishmentAuthorityId: "physical-establishment",
      establishmentSource: "native-project-creation", status: "active",
      establishedAt: new Date(),
    });
    const ownershipBefore = await ownership.findOne({ projectId });
    const authority = createMovieMentorCreatorStateReadAuthority({
      ownershipAuthority: createMovieMentorProjectOwnershipAuthority(),
      readCreatorState: readAuthoritativeTurnSource,
    });
    const owner = await authority.read({ principal: { authenticated: true, principalId: "physical-owner" }, projectId });
    assert.equal(owner.authorized, true, "RED: durable owner must recover");
    assert.equal(owner.state.revision, 1);
    const foreign = await authority.read({ principal: { authenticated: true, principalId: "physical-foreigner" }, projectId });
    assert.equal(foreign.authorized, false, "RED: foreign principal must not recover");
    assert.deepEqual(await ownership.findOne({ projectId }), ownershipBefore, "RED: ownership mutated during read");
    assert.deepEqual(await states.findOne({ projectId }), before, "RED: creator state mutated during owner-bound read");
    console.log("GREEN PHYSICAL MONGO: actual durable ownership allows owner, denies foreign principal, leaves both records immutable");

    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const issuer = "https://physical-clerk.example";
    const audience = "movie-mentor-physical";
    const origin = "http://127.0.0.1:7777";
    const authentication = createMovieMentorProductionAuthenticationComposition({
      env: {
        MOVIE_MENTOR_CLERK_JWT_KEY: publicKey.export({ type: "spki", format: "pem" }),
        MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON: JSON.stringify([origin]),
        MOVIE_MENTOR_CLERK_ISSUER: issuer,
        MOVIE_MENTOR_AUDIENCE: audience,
      },
    });
    assert.equal(authentication.ready, true);
    const composition = createMovieMentorCreatorStateRecoveryProductionComposition({
      authentication,
      ownershipAuthority: createMovieMentorProjectOwnershipAuthority(),
      readCreatorState: readAuthoritativeTurnSource,
    });
    function signJwt(subject, key = privateKey) {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({
        iss: issuer, sub: subject, aud: audience, azp: origin,
        sid: "physical-session", iat: now, nbf: now - 1, exp: now + 300,
      })).toString("base64url");
      const signingInput = header + "." + payload;
      const signer = createSign("RSA-SHA256");
      signer.update(signingInput);
      signer.end();
      return signingInput + "." + signer.sign(key).toString("base64url");
    }
    const server = createServer(async (req, res) => {
      try {
        const match = /^\/api\/movie-mentor\/state\/recovery\/([^/]+)$/.exec(req.url || "");
        const result = await composition.handle({
          method: req.method,
          params: { projectId: match ? decodeURIComponent(match[1]) : "" },
          headers: { authorization: req.headers.authorization },
        });
        res.writeHead(result.status, { "content-type": "application/json" });
        res.end(JSON.stringify(result.body));
      } catch {
        res.writeHead(503);
        res.end();
      }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    async function request(method, token) {
      const response = await fetch("http://127.0.0.1:" + port + "/api/movie-mentor/state/recovery/" + projectId, {
        method, headers: token ? { authorization: "Bearer " + token } : {},
      });
      return { status: response.status, body: await response.json() };
    }
    try {
      const ownerResponse = await request("GET", signJwt("physical-owner"));
      assert.equal(ownerResponse.status, 200, "RED: signed owner HTTP recovery must succeed");
      assert.equal(ownerResponse.body.state.projectId, projectId);
      const foreignResponse = await request("GET", signJwt("physical-foreigner"));
      assert.equal(foreignResponse.status, 403, "RED: signed foreign principal must be denied");
      const { privateKey: forgedKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
      const forgedResponse = await request("GET", signJwt("physical-owner", forgedKey));
      assert.equal(forgedResponse.status, 401, "RED: forged RS256 signature must be denied");
      const postResponse = await request("POST", signJwt("physical-owner"));
      assert.equal(postResponse.status, 405, "RED: read-only endpoint must reject POST");
      assert.deepEqual(await ownership.findOne({ projectId }), ownershipBefore);
      assert.deepEqual(await states.findOne({ projectId }), before);
      console.log("GREEN PHYSICAL HTTP: signed RS256 owner GET, foreign/forged denial, POST denial and immutable Mongo");
    } finally {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    return Object.freeze({
      realRs256: true, loopbackHttp: true, isolatedMongo: true,
      durableOwnerAllowed: true, foreignOwnerDenied: true, forgedJwtDenied: true, readOnlyLedger: true,
    });
  } finally {
    await mongoose.disconnect();
  }
}
