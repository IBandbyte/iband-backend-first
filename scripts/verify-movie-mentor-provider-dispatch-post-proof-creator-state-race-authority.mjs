import assert from "node:assert/strict";
import { createCreatorStateConsumptionRuntimeDeps } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

console.log("5A.34 — provider dispatch post-proof Creator-state chronology authority");

const projectId="project-post-proof-race";
let durableState={
  projectId,
  creatorSessionId:"session-post-proof-race",
  revision:12,
  revisionAuthorityReference:"revision-12",
  creatorStateGeneration:8,
  creatorStateFingerprint:"state-fingerprint-8",
  creatorAuthorityReference:"creator-authority-8",
  snapshotReference:"snapshot-12",
  creatorConfirmedContext:[],
};
let providerEffects=0;
let stagedCandidates=0;
let providerDispatchProofs=0;
let unknownDurable=false;

const authority=Object.freeze({
  domain:"iband.movie-mentor.creator-state-consumption-authority",
  schema:1,
  principalId:"creator-7",
  projectId,
  async assertCurrentConsumption(target={}){
    const proof=Object.freeze({
      domain:"iband.movie-mentor.creator-state-consumption-proof",
      schema:1,
      authorized:true,
      currentOwnershipVerified:true,
      principalId:"creator-7",
      projectId,
      ownershipRef:"ownership-1",
      ownershipRevision:1,
      stage:target.stage,
      revision:target.revision,
      creatorStateGeneration:target.creatorStateGeneration,
      creatorStateFingerprint:target.creatorStateFingerprint,
      executionId:target.executionId||null,
      providerCallId:target.providerCallId||null,
    });
    if(target.stage==="provider-dispatch"){
      providerDispatchProofs+=1;
      // Production has already durably crossed provider-effect UNKNOWN before
      // this final current-state proof. A concurrent Creator transition may
      // therefore make the eventual external effect historical, but it must
      // never let that historical universe become current result authority.
      assert.equal(unknownDurable,true,"provider-effect UNKNOWN must precede the final dispatch proof");
      durableState={
        ...durableState,
        revision:13,
        revisionAuthorityReference:"revision-13",
        creatorStateGeneration:9,
        creatorStateFingerprint:"state-fingerprint-9",
        creatorAuthorityReference:"creator-authority-9",
        snapshotReference:"snapshot-13",
      };
    }
    return proof;
  },
});

const baseExecutionAuthority={
  async beginProviderDispatch({providerCall}={}){
    unknownDurable=true;
    return {dispatchAuthorized:true,executionId:providerCall.executionId,providerCallId:providerCall.providerCallId,providerEffectState:"unknown"};
  },
  async assertProviderDispatch({providerCall}={}){
    return {dispatchAuthorized:true,executionId:providerCall.executionId,providerCallId:providerCall.providerCallId};
  },
  async stageResultCandidate({execution,resultPayload}={}){
    stagedCandidates+=1;
    return {candidateReference:"candidate-race",executionId:execution.executionId,resultPayload};
  },
};

const guarded=createCreatorStateConsumptionRuntimeDeps({
  creatorStateConsumptionAuthority:authority,
  readAuthoritativeTurnSource:async()=>structuredClone(durableState),
  inferenceExecutionAuthority:baseExecutionAuthority,
});

await guarded.readAuthoritativeTurnSource({projectId});
const providerCall={executionId:"execution-race",providerCallId:"provider-race"};
const unknown=await guarded.inferenceExecutionAuthority.beginProviderDispatch({providerCall});
assert.equal(unknown.dispatchAuthorized,true);
assert.equal(unknownDurable,true);

const dispatch=await guarded.inferenceExecutionAuthority.assertProviderDispatch({providerCall});
assert.equal(dispatch.dispatchAuthorized,true);
assert.equal(providerDispatchProofs,1,"court must reach the final provider-dispatch Creator-state proof");
assert.equal(durableState.revision,13,"adversary must advance Creator state only after the final proof is granted");
assert.equal(durableState.creatorStateGeneration,9);

// The external call may now complete under the already-durable UNKNOWN
// operation. That effect is historical evidence, not current Creator authority.
providerEffects+=1;
assert.equal(providerEffects,1,"post-UNKNOWN external effect may exist as historical provider reality");

await assert.rejects(
  ()=>guarded.inferenceExecutionAuthority.stageResultCandidate({
    execution:{executionId:"execution-race"},
    resultPayload:{success:true,text:"historical result"},
  }),
  error=>error?.code==="MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_STALE",
  "historical post-proof provider effect must not cross into a result candidate after Creator state advances",
);
assert.equal(stagedCandidates,0,"superseded Creator-state provider output must produce zero durable result-candidate writes");

console.log("GREEN: post-proof Creator-state advance may leave historical provider evidence, but cannot promote it into current result authority.");
console.log("LAW: UNKNOWN MAY BECOME HISTORICAL EFFECT REALITY; CURRENT RESULT AUTHORITY MUST RE-EARN THE CREATOR-STATE UNIVERSE AFTER THAT EFFECT.");
