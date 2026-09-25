import assert from "node:assert/strict";
import { createCreatorStateConsumptionRuntimeDeps } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

console.log("5A.34 — provider dispatch post-proof Creator-state race authority");

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
let providerDispatchProofs=0;

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
      // Adversarial concurrent writer commits immediately after the final
      // current-state reread/proof, before the external provider effect.
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

const guarded=createCreatorStateConsumptionRuntimeDeps({
  creatorStateConsumptionAuthority:authority,
  readAuthoritativeTurnSource:async()=>structuredClone(durableState),
  inferenceExecutionAuthority:{
    async assertProviderDispatch({providerCall}={}){
      return {dispatchAuthorized:true,executionId:providerCall.executionId,providerCallId:providerCall.providerCallId};
    },
  },
});

await guarded.readAuthoritativeTurnSource({projectId});
const dispatch=await guarded.inferenceExecutionAuthority.assertProviderDispatch({
  providerCall:{executionId:"execution-race",providerCallId:"provider-race"},
});

assert.equal(providerDispatchProofs,1,"court must reach the final provider-dispatch Creator-state proof");
assert.equal(durableState.revision,13,"adversary must advance Creator state only after the final proof is granted");
assert.equal(durableState.creatorStateGeneration,9);
if(dispatch?.dispatchAuthorized===true) providerEffects+=1;

// Security law: a Creator-state universe superseded before irreversible network
// dispatch must produce zero provider effects.
assert.equal(
  providerEffects,
  0,
  "post-proof Creator-state advance must revoke provider dispatch before irreversible external effect",
);

console.log("GREEN: post-proof Creator-state advance cannot cross into irreversible provider effect.");
console.log("LAW: CURRENT-STATE PROOF MUST REMAIN PHYSICALLY SERIALIZED THROUGH THE IRREVERSIBLE PROVIDER BOUNDARY.");
