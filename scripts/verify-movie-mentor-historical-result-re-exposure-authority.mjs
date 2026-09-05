import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildRequestDigest } from "../ai/MovieMentorTurnRuntime.js";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

console.log("5A.26 — historical result re-exposure authority torture");

const canonicalize=value=>value===null||typeof value!=="object"?value:Array.isArray(value)?value.map(canonicalize):Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalize(value[key])]));
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
const body={projectId:"project-1",creatorTurnId:"turn-1",message:"Help me shape this scene",options:{mode:"guide"}};
const payload={success:true,projectId:"project-1",mentorResponse:{text:"Start with the emotional turn."},metadata:{source:"runtime"}};
const requestDigest=buildRequestDigest({creatorMessage:body.message,projectId:body.projectId,options:body.options});
const canonical={authorized:true,committed:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,executionPhase:"settled",executionId:"execution-1",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest,resultReference:"result-1",candidateReference:"candidate-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1",resultDigest:digest(payload),resultPayload:structuredClone(payload),providerEffectRealityRevision:7};
const settlement={authorized:true,settled:true,outcome:"consumed",resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:7,executionId:"execution-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",resultReference:"result-1",resultDigest:canonical.resultDigest,closureCertificateDigest:"closure-digest-1"};
const runtimeResult=()=>({...structuredClone(payload),metadata:{...structuredClone(payload.metadata),canonicalResult:{authorized:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,creatorResponseAuthorityVerified:true,resultReference:"result-1",resultDigest:canonical.resultDigest,executionId:"execution-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1",reservationId:"reservation-1",settlement:"consumed",settlementExecutionPhase:"settled",replayedFromDurableResult:true}}});
const spend={reserveTurn:async()=>({}),readReservation:async()=>({})};
const executionMethods=()=>Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult"].map(name=>[name,async()=>({})]));
const execution={...executionMethods(),readCanonicalResult:async()=>structuredClone(canonical)};
const settlementAuthority={reconcile:async()=>structuredClone(settlement),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})};
const response=()=>({statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){this.payload=value;return this;}});

async function invoke({revokeAfterAdmission=false,current=true}={}){
  let ownershipCurrent=current,authorizeCalls=0,exposures=0;
  const requestAuthority={authorize:async()=>{authorizeCalls+=1;if(!ownershipCurrent)return{authorized:false};const admitted={authorized:true,principalId:"creator-1",projectId:"project-1",ownershipRef:"ownership:project-1",ownershipRevision:1,authorizationSource:"historical-re-exposure-torture"};if(revokeAfterAdmission&&authorizeCalls===1)ownershipCurrent=false;return admitted;}};
  const router=createMovieMentorTurnRouter({requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlementAuthority,runTurn:async()=>runtimeResult(),applyStateTransition:async()=>({})});
  const turn=router.stack.find(layer=>layer.route?.path==="/turn"),res=response();
  const originalJson=res.json;res.json=function(value){if(value?.success===true)exposures+=1;return originalJson.call(this,value);};
  await turn.route.stack[0].handle({body,headers:{authorization:"Bearer token"}},res);
  return{res,authorizeCalls,exposures};
}

const revokedBefore=await invoke({current:false});
assert.equal(revokedBefore.exposures,0,"revoked ownership before admission must expose zero historical results");

const revokedRace=await invoke({revokeAfterAdmission:true});
assert.equal(revokedRace.exposures,0,"ownership revoked after admission but before historical HTTP exposure must expose zero results");
assert.ok(revokedRace.authorizeCalls>=2,"historical re-exposure must re-earn current creator/project ownership at the exposure boundary");

const positive=await invoke();
assert.equal(positive.res.statusCode,200,"current ownership may receive the exact historical settled result");
assert.equal(positive.exposures,1,"current ownership receives exactly one historical result exposure");
assert.ok(positive.authorizeCalls>=2,"positive historical re-exposure independently re-earns current ownership");

console.log("✓ revoked ownership cannot re-expose a historically valid settled result");
console.log("✓ revocation after request admission but before creator HTTP exposure fails closed");
console.log("✓ current ownership may re-expose exactly one exact historical settled result");
console.log("LAW: a result may remain true after ownership revocation; the right to re-expose it may not");
console.log("5A.26 historical result re-exposure authority torture: GREEN");
