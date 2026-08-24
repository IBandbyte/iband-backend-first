/**
 * Movie Mentor Operations Replay + Freshness Control v1.0.0
 * --------------------------------------------------------
 * Deterministic anti-replay / bounded-freshness contract.
 *
 * STATUS:
 * - Standalone, dormant, not wired to production storage.
 * - NOT an AI agent.
 * - Grants no operational authority.
 */
const VERSION="1.0.0";
const CONTRACT_VERSION="1.0.0";
const CONTROL_ID="operations-replay-freshness-control";
const AUTHORITY="operations-replay-freshness-contract-only";
const ALLOWED_KINDS=Object.freeze(["transition-authorisation","recovery-verification","rollback-verification","quarantine-release-authorisation","emergency-authorisation"]);
const DEFAULT_MAX_WINDOW_MS=15*60*1000;
const DEFAULT_CLOCK_SKEW_MS=30*1000;

function cleanString(v){return typeof v==="string"?v.trim():""}
function cloneValue(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v))}catch{return v}}
function parseTime(v){const ms=typeof v==="number"?v:Date.parse(v);return Number.isFinite(ms)?ms:null}
function createFreshnessToken({kind,incidentId,subjectId,nonce,issuedAt,expiresAt,correlationId=null,stateSequence=null,metadata={}}={}){return{controlId:CONTROL_ID,kind:cleanString(kind),incidentId:cleanString(incidentId),subjectId:cleanString(subjectId),nonce:cleanString(nonce),issuedAt:cleanString(issuedAt),expiresAt:cleanString(expiresAt),correlationId:cleanString(correlationId)||null,stateSequence:Number.isInteger(stateSequence)?stateSequence:null,authority:AUTHORITY,singleUse:true,metadata:cloneValue(metadata||{})}}
function validateFreshnessToken(token={}, {expectedKind=null,expectedIncidentId=null,expectedSubjectId=null,expectedCorrelationId=null,expectedStateSequence=null,now=Date.now(),maxWindowMs=DEFAULT_MAX_WINDOW_MS,clockSkewMs=DEFAULT_CLOCK_SKEW_MS}={}){
  const issues=[];
  if(token.controlId!==CONTROL_ID||token.authority!==AUTHORITY||token.singleUse!==true)issues.push("freshness_contract_invalid");
  if(!ALLOWED_KINDS.includes(cleanString(token.kind)))issues.push("freshness_kind_invalid");
  if(!cleanString(token.incidentId))issues.push("freshness_incident_id_required");
  if(!cleanString(token.subjectId))issues.push("freshness_subject_id_required");
  if(!cleanString(token.nonce))issues.push("freshness_nonce_required");
  const issued=parseTime(token.issuedAt),expires=parseTime(token.expiresAt),nowMs=parseTime(now);
  if(issued===null)issues.push("freshness_issued_at_invalid");
  if(expires===null)issues.push("freshness_expires_at_invalid");
  if(nowMs===null)issues.push("trusted_now_invalid");
  if(issued!==null&&expires!==null){if(expires<=issued)issues.push("freshness_window_invalid");if(expires-issued>maxWindowMs)issues.push("freshness_window_too_long")}
  if(nowMs!==null&&issued!==null&&nowMs+clockSkewMs<issued)issues.push("freshness_not_yet_valid");
  if(nowMs!==null&&expires!==null&&nowMs-clockSkewMs>expires)issues.push("freshness_expired");
  if(expectedKind&&cleanString(token.kind)!==cleanString(expectedKind))issues.push("freshness_kind_mismatch");
  if(expectedIncidentId&&cleanString(token.incidentId)!==cleanString(expectedIncidentId))issues.push("freshness_incident_mismatch");
  if(expectedSubjectId&&cleanString(token.subjectId)!==cleanString(expectedSubjectId))issues.push("freshness_subject_mismatch");
  if(expectedCorrelationId&&cleanString(token.correlationId)!==cleanString(expectedCorrelationId))issues.push("freshness_correlation_mismatch");
  if(Number.isInteger(expectedStateSequence)&&token.stateSequence!==expectedStateSequence)issues.push("freshness_state_sequence_mismatch");
  return{valid:issues.length===0,issues,replayKey:issues.length?null:`${cleanString(token.kind)}:${cleanString(token.incidentId)}:${cleanString(token.subjectId)}:${cleanString(token.nonce)}`,issuedAtMs:issued,expiresAtMs:expires};
}
async function claimFreshnessToken(token={}, expectations={}, {singleUseLedger=null,now=Date.now()}={}){
  const validation=validateFreshnessToken(token,{...expectations,now});
  if(!validation.valid)return{claimed:false,reasons:validation.issues,replayKey:null};
  if(typeof singleUseLedger?.claim!=="function")return{claimed:false,reasons:["trusted_single_use_ledger_required"],replayKey:validation.replayKey};
  let claim;try{claim=await singleUseLedger.claim({replayKey:validation.replayKey,kind:token.kind,incidentId:token.incidentId,subjectId:token.subjectId,nonce:token.nonce,expiresAt:token.expiresAt})}catch{return{claimed:false,reasons:["single_use_ledger_claim_failed"],replayKey:validation.replayKey}}
  if(claim?.claimed!==true)return{claimed:false,reasons:[cleanString(claim?.reason)||"freshness_token_already_consumed"],replayKey:validation.replayKey};
  const reference=cleanString(claim?.reference);if(!reference)return{claimed:false,reasons:["single_use_claim_reference_required"],replayKey:validation.replayKey};
  return{claimed:true,reasons:[],replayKey:validation.replayKey,claimReference:reference};
}
function getOperationsReplayFreshnessControlManifest(){return{id:CONTROL_ID,name:"Movie Mentor Operations Replay + Freshness Control",version:VERSION,contractVersion:CONTRACT_VERSION,status:"standalone-dormant-not-wired",authority:AUTHORITY,deterministicControl:true,aiAgent:false,singleUse:true,defaultMaxWindowMs:DEFAULT_MAX_WINDOW_MS,defaultClockSkewMs:DEFAULT_CLOCK_SKEW_MS,requirements:["bounded-issued-expiry-window","incident-and-subject-binding","cryptographically-unpredictable-nonce-at-runtime","trusted-clock-evaluation","external-atomic-single-use-ledger","traceable-claim-reference"],restrictions:["cannot-grant-operational-authority","cannot-trust-expired-or-future-dated-token","cannot-reuse-consumed-token","cannot-self-issue-trusted-nonce","no-live-persistence-clock-or-authorisation-adapters"]}}
export{VERSION as OPERATIONS_REPLAY_FRESHNESS_VERSION,CONTRACT_VERSION as OPERATIONS_REPLAY_FRESHNESS_CONTRACT_VERSION,CONTROL_ID as OPERATIONS_REPLAY_FRESHNESS_CONTROL_ID,AUTHORITY as OPERATIONS_REPLAY_FRESHNESS_AUTHORITY,ALLOWED_KINDS as OPERATIONS_REPLAY_FRESHNESS_KINDS,DEFAULT_MAX_WINDOW_MS,DEFAULT_CLOCK_SKEW_MS,createFreshnessToken,validateFreshnessToken,claimFreshnessToken,getOperationsReplayFreshnessControlManifest};
export default validateFreshnessToken;
