import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildRequestDigest } from "../ai/MovieMentorTurnRuntime.js";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

console.log("5A.26 — creator HTTP late provider-reality exposure authority");

const stable=value=>value===null||typeof value!=="object"?value:Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const body={projectId:"project-late-reality",creatorTurnId:"turn-late-reality",message:"Shape this scene",options:{}};
const payload={success:true,projectId:body.projectId,mentorResponse:{text:"Historical settled result."},metadata:{source:"runtime"}};
const resultDigest=digest(payload), requestDigest=buildRequestDigest({creatorMessage:body.message,projectId:body.projectId,options:body.options});
let realityRevision=7, quarantined=false, authorizeCalls=0, exposures=0;

const canonical=()=>quarantined
 ? {authorized:false,committed:true,revoked:true,quarantined:true,reason:"canonical-result-historical-revoked"}
 : {authorized:true,committed:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:realityRevision,executionId:"execution-late-reality",creatorTurnId:body.creatorTurnId,principalId:"creator-late-reality",projectId:body.projectId,reservationId:"reservation-late-reality",requestDigest,resultReference:"result-late-reality",candidateReference:"candidate-late-reality",closureReference:"closure-late-reality",closureCertificateDigest:"closure-digest-late-reality",resultDigest,resultPayload:structuredClone(payload)};
const settlement=()=>({authorized:true,settled:true,outcome:"consumed",resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:realityRevision,executionId:"execution-late-reality",principalId:"creator-late-reality",projectId:body.projectId,reservationId:"reservation-late-reality",resultReference:"result-late-reality",candidateReference:"candidate-late-reality",resultDigest,closureCertificateDigest:"closure-digest-late-reality"});
const runtimeResult=()=>({...structuredClone(payload),metadata:{...payload.metadata,canonicalResult:{authorized:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,creatorResponseAuthorityVerified:true,resultReference:"result-late-reality",candidateReference:"candidate-late-reality",resultDigest,executionId:"execution-late-reality",closureReference:"closure-late-reality",closureCertificateDigest:"closure-digest-late-reality",reservationId:"reservation-late-reality",settlement:"consumed",settlementExecutionPhase:"settled",replayedFromDurableResult:true}}});

const requestAuthority={authorize:async()=>{
 authorizeCalls+=1;
 if(authorizeCalls===2){ realityRevision=8; quarantined=true; }
 return {authorized:true,principalId:"creator-late-reality",projectId:body.projectId,ownershipRef:"ownership-late-reality",ownershipRevision:1,authorizationSource:"late-reality-verifier"};
}};
const spend={reserveTurn:async()=>({}),readReservation:async()=>({})};
const methods=Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult"].map(name=>[name,async()=>({})]));
const execution={...methods,readCanonicalResult:async()=>structuredClone(canonical())};
const settlementAuthority={reconcile:async()=>structuredClone(settlement()),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})};
const router=createMovieMentorTurnRouter({requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlementAuthority,runTurn:async()=>runtimeResult(),applyStateTransition:async()=>({})});
const turn=router.stack.find(layer=>layer.route?.path==="/turn");
const res={statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){if(value?.success===true)exposures+=1;this.payload=value;return this;}};
await turn.route.stack[0].handle({body,headers:{authorization:"Bearer token"}},res);

assert.equal(quarantined,true,"verifier must inject late contradictory provider reality after HTTP canonical/settlement proof");
assert.ok(authorizeCalls>=2,"gateway must reach final ownership reauthorization");
assert.equal(exposures,0,"creator HTTP exposure must not emit a settled canonical result after provider reality became conflicting before res.json");
assert.notEqual(res.statusCode,200,"late provider-reality revocation before response emission must fail closed");
console.log("LAW: CREATOR HTTP EXPOSURE MAY NOT BORROW A PROVIDER-REALITY PROOF THAT BECAME STALE BEFORE RESPONSE EMISSION.");
