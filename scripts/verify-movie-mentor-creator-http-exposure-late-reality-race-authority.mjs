import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildRequestDigest } from "../ai/MovieMentorTurnRuntime.js";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

console.log("Creator HTTP exposure late provider-reality race authority");

const stable=value=>value===null||typeof value!=="object"?value:Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const body={projectId:"project-late-reality",creatorTurnId:"turn-late-reality",message:"Shape this scene",options:{mode:"guide"}};
const payload={success:true,projectId:body.projectId,mentorResponse:{text:"Canonical settled result."},metadata:{source:"runtime"}};
const requestDigest=buildRequestDigest({creatorMessage:body.message,projectId:body.projectId,options:body.options});
let realityRevision=7;
let quarantined=false;
let authorizeCalls=0;
let successfulExposures=0;

const authority=()=>({authorized:true,principalId:"creator-late-reality",projectId:body.projectId,ownershipRef:"ownership:late-reality",ownershipRevision:1,authorizationSource:"late-reality-race"});
const canonical=()=>quarantined
 ? {authorized:false,committed:true,revoked:true,quarantined:true,reason:"canonical-result-historical-revoked",resultReference:"result-late-reality",reservationId:"reservation-late-reality"}
 : {authorized:true,committed:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:realityRevision,executionId:"execution-late-reality",creatorTurnId:body.creatorTurnId,principalId:"creator-late-reality",projectId:body.projectId,reservationId:"reservation-late-reality",requestDigest,resultReference:"result-late-reality",candidateReference:"candidate-late-reality",closureReference:"closure-late-reality",closureCertificateDigest:"closure-digest-late-reality",resultDigest:digest(payload),resultPayload:structuredClone(payload)};
const settlement=()=>({authorized:true,settled:true,outcome:"consumed",resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:realityRevision,executionId:"execution-late-reality",principalId:"creator-late-reality",projectId:body.projectId,reservationId:"reservation-late-reality",resultReference:"result-late-reality",candidateReference:"candidate-late-reality",resultDigest:digest(payload),closureCertificateDigest:"closure-digest-late-reality"});
const runtimeResult=()=>({...structuredClone(payload),metadata:{...payload.metadata,canonicalResult:{authorized:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,creatorResponseAuthorityVerified:true,resultReference:"result-late-reality",candidateReference:"candidate-late-reality",resultDigest:digest(payload),executionId:"execution-late-reality",closureReference:"closure-late-reality",closureCertificateDigest:"closure-digest-late-reality",reservationId:"reservation-late-reality",settlement:"consumed",settlementExecutionPhase:"settled"}}});

const requestAuthority={authorize:async()=>{authorizeCalls+=1;if(authorizeCalls===2){realityRevision=8;quarantined=true;}return{body,authority:authority()};}};
const spend={reserveTurn:async()=>({}),readReservation:async()=>({})};
const executionMethods=()=>Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult"].map(name=>[name,async()=>({})]));
const execution={...executionMethods(),readCanonicalResult:async()=>structuredClone(canonical())};
const settlementAuthority={reconcile:async()=>structuredClone(settlement()),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})};
const router=createMovieMentorTurnRouter({requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlementAuthority,runTurn:async()=>runtimeResult(),applyStateTransition:async()=>({})});
const turn=router.stack.find(layer=>layer.route?.path==="/turn");
const res={statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){this.payload=value;if(value?.success===true)successfulExposures+=1;return this;}};
await turn.route.stack[0].handle({body,headers:{authorization:"Bearer token"}},res);

assert.equal(authorizeCalls,2,"race must occur during the final ownership reauthorization after HTTP reality proof");
assert.equal(quarantined,true,"late contradictory provider reality must revoke the settled canonical universe before response emission");
assert.equal(successfulExposures,0,"creator HTTP exposure must not emit a stale successful result after provider reality is revoked during final reauthorization");

console.log("GREEN: final creator exposure revalidates provider reality after the last await before response emission.");
console.log("LAW: CURRENT CREATOR OWNERSHIP AND CURRENT PROVIDER REALITY MUST BOTH SURVIVE THE FINAL ASYNCHRONOUS EXPOSURE BOUNDARY.");
