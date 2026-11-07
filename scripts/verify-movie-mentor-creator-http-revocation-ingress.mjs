import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { once } from "node:events";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

// Isolated real HTTP ingress court. No production connection, writes or live identity provider.
// This is deliberately NOT a Mongo integration verdict or a replacement for the original RED.
const methods = ["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"];
const execution = Object.fromEntries(methods.map(k => [k, async () => { throw new Error("unexpected execution call: " + k); }]));
const spend = { reserveTurn: async () => { throw new Error("unexpected spend"); }, readReservation: async () => { throw new Error("unexpected spend read"); } };
const settlement = { reconcile: async () => { throw new Error("unexpected settlement"); }, releaseUnclaimed: async () => { throw new Error("unexpected release"); }, releaseUnbound: async () => { throw new Error("unexpected release"); } };
let revoked = false, authorizationCalls = 0, readinessCalls = 0, transitionCalls = 0, turnCalls = 0;
const requestAuthority = { async authorize({request, projectId}) {
  authorizationCalls++;
  if (request.headers.authorization !== "Bearer isolated-valid" || revoked) {
    const e = new Error("Credential denied"); e.code = "MOVIE_MENTOR_AUTH_REVOKED"; throw e;
  }
  if (projectId !== "isolated-project") {
    const e = new Error("Wrong project"); e.code = "MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED"; throw e;
  }
  return {authorized:true,principalId:"isolated-owner",projectId,ownershipRef:"isolated-ownership",ownershipRevision:1};
}};
const router = createMovieMentorTurnRouter({
  requestAuthority, inferenceSpendAuthority:spend, inferenceExecutionAuthority:execution,
  inferenceSettlementAuthority:settlement, requireAtomicCreatorStateOperation:true,
  atomicCreatorStateReadiness:async () => { readinessCalls++; return async () => { throw new Error("unexpected atomic write"); }; },
  applyStateTransition:async () => { transitionCalls++; throw new Error("unexpected transition"); },
  runTurn:async () => { turnCalls++; throw new Error("unexpected turn"); }
});
const app = express(); app.use(express.json()); app.use("/api/movie-mentor",router);
const server = createServer(app); server.listen(0,"127.0.0.1"); await once(server,"listening");
try {
  const base = "http://127.0.0.1:" + server.address().port;
  for (const path of ["/state/sync","/turn"]) {
    for (const token of [null,"Bearer wrong"]) {
      const response = await fetch(base + "/api/movie-mentor" + path,{method:"POST",headers:{"content-type":"application/json",...(token?{authorization:token}:{})},body:JSON.stringify({projectId:"isolated-project"})});
      assert.notEqual(response.status,200,"Unauthorized HTTP request must not succeed");
      const body=await response.json(); assert.equal(body.success,false);
    }
    revoked=true;
    const response = await fetch(base + "/api/movie-mentor" + path,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer isolated-valid"},body:JSON.stringify({projectId:"isolated-project"})});
    assert.notEqual(response.status,200,"Revoked credential must be denied");
    const body=await response.json(); assert.equal(body.success,false);
    revoked=false;
    console.log("GREEN HTTP DENIAL:",path,"missing, invalid and revoked credentials rejected");
  }
  assert.equal(readinessCalls,0,"Unauthorized requests must not reach atomic readiness");
  assert.equal(transitionCalls,0,"Unauthorized requests must not reach state transition");
  assert.equal(turnCalls,0,"Unauthorized requests must not reach turn runtime");
  assert.equal(authorizationCalls,6);
  console.log("GREEN: real loopback HTTP unauthorized requests cannot enter creator-state or inference execution");
  console.log("LIMITATION: HTTP ingress denial only; no physical Mongo, post-admission revocation race, live provider or authorized success path.");
} finally { await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())); }
