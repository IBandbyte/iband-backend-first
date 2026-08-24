/**
 * Movie Mentor Operations Scope Isolation Control v1.0.0
 * ------------------------------------------------------
 * Deterministic boundary preventing Operations evidence from crossing
 * incident, environment, service, region, project, creator-session or
 * correlation scopes without explicit trusted attestation.
 *
 * STATUS: standalone / dormant / no live adapters / not an AI agent.
 */
import { createHash } from "node:crypto";

const VERSION="1.0.0";
const CONTRACT_VERSION="1.0.0";
const CONTROL_ID="operations-scope-isolation-control";
const AUTHORITY="operations-scope-isolation-contract-only";

function cleanString(v){return typeof v==="string"?v.trim():""}
function cloneValue(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v))}catch{return v}}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.keys(v).sort().reduce((o,k)=>(o[k]=stable(v[k]),o),{});return v}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}

function createOperationsScope({scopeId,incidentId=null,environment,service,region=null,projectId=null,creatorSessionId=null,correlationId=null,metadata={}}={}){
  const descriptor={
    scopeId:cleanString(scopeId),
    incidentId:cleanString(incidentId)||null,
    environment:cleanString(environment),
    service:cleanString(service),
    region:cleanString(region)||null,
    projectId:cleanString(projectId)||null,
    creatorSessionId:cleanString(creatorSessionId)||null,
    correlationId:cleanString(correlationId)||null,
  };
  return{controlId:CONTROL_ID,descriptor,scopeFingerprint:digest(descriptor),authority:AUTHORITY,failClosed:true,metadata:cloneValue(metadata||{})};
}

function validateOperationsScope(scope={}){
  const issues=[];
  if(scope.controlId!==CONTROL_ID||scope.authority!==AUTHORITY||scope.failClosed!==true)issues.push("scope_contract_invalid");
  const d=scope?.descriptor||{};
  if(!cleanString(d.scopeId))issues.push("scope_id_required");
  if(!cleanString(d.environment))issues.push("scope_environment_required");
  if(!cleanString(d.service))issues.push("scope_service_required");
  const expected=digest({scopeId:cleanString(d.scopeId),incidentId:cleanString(d.incidentId)||null,environment:cleanString(d.environment),service:cleanString(d.service),region:cleanString(d.region)||null,projectId:cleanString(d.projectId)||null,creatorSessionId:cleanString(d.creatorSessionId)||null,correlationId:cleanString(d.correlationId)||null});
  if(cleanString(scope.scopeFingerprint)!==expected)issues.push("scope_fingerprint_invalid");
  return{valid:!issues.length,issues,scopeFingerprint:issues.length?null:expected};
}

function compareOperationsScopes(expected={},actual={}){
  const a=validateOperationsScope(expected),b=validateOperationsScope(actual),issues=[];
  if(!a.valid)issues.push(...a.issues.map(x=>`expected:${x}`));
  if(!b.valid)issues.push(...b.issues.map(x=>`actual:${x}`));
  if(issues.length)return{valid:false,issues};
  const e=expected.descriptor,c=actual.descriptor;
  const fields=["scopeId","incidentId","environment","service","region","projectId","creatorSessionId","correlationId"];
  for(const field of fields)if((cleanString(e[field])||null)!==(cleanString(c[field])||null))issues.push(`scope_${field}_mismatch`);
  if(expected.scopeFingerprint!==actual.scopeFingerprint)issues.push("scope_fingerprint_mismatch");
  return{valid:!issues.length,issues,scopeFingerprint:expected.scopeFingerprint};
}

function createScopedEvidenceEnvelope({envelopeId,sourceRuntimeIdentity,evidenceReference,scope,evidenceType=null,capturedAt=null,metadata={}}={}){
  return{
    controlId:CONTROL_ID,
    envelopeId:cleanString(envelopeId),
    sourceRuntimeIdentity:cleanString(sourceRuntimeIdentity),
    evidenceReference:cleanString(evidenceReference),
    evidenceType:cleanString(evidenceType)||null,
    capturedAt:cleanString(capturedAt)||null,
    scope:cloneValue(scope),
    authority:AUTHORITY,
    failClosed:true,
    metadata:cloneValue(metadata||{}),
  };
}

function validateScopedEvidenceEnvelope(envelope={},expectedScope=null){
  const issues=[];
  if(envelope.controlId!==CONTROL_ID||envelope.authority!==AUTHORITY||envelope.failClosed!==true)issues.push("evidence_scope_contract_invalid");
  if(!cleanString(envelope.envelopeId))issues.push("evidence_envelope_id_required");
  if(!cleanString(envelope.sourceRuntimeIdentity))issues.push("evidence_source_runtime_identity_required");
  if(!cleanString(envelope.evidenceReference))issues.push("evidence_reference_required");
  const own=validateOperationsScope(envelope.scope||{});if(!own.valid)issues.push(...own.issues.map(x=>`evidence:${x}`));
  if(expectedScope){const match=compareOperationsScopes(expectedScope,envelope.scope||{});if(!match.valid)issues.push(...match.issues)}
  return{valid:!issues.length,issues,scopeFingerprint:own.valid?own.scopeFingerprint:null};
}

async function verifyScopedEvidenceEnvelope(envelope={},expectedScope=null,{verifyScopeAttestation=null}={}){
  const shape=validateScopedEvidenceEnvelope(envelope,expectedScope);
  if(!shape.valid)return{verified:false,reasons:shape.issues,reference:null};
  if(typeof verifyScopeAttestation!=="function")return{verified:false,reasons:["trusted_scope_attestation_verifier_required"],reference:null};
  let verdict;try{verdict=await verifyScopeAttestation({envelopeId:envelope.envelopeId,sourceRuntimeIdentity:envelope.sourceRuntimeIdentity,evidenceReference:envelope.evidenceReference,evidenceType:envelope.evidenceType,scopeFingerprint:shape.scopeFingerprint,scope:cloneValue(envelope.scope)})}catch{return{verified:false,reasons:["trusted_scope_attestation_verification_failed"],reference:null}}
  if(verdict?.valid!==true)return{verified:false,reasons:[cleanString(verdict?.reason)||"trusted_scope_attestation_not_verified"],reference:null};
  const reference=cleanString(verdict?.reference);if(!reference)return{verified:false,reasons:["trusted_scope_attestation_reference_required"],reference:null};
  return{verified:true,reasons:[],reference,scopeFingerprint:shape.scopeFingerprint};
}

function getOperationsScopeIsolationControlManifest(){return{
  id:CONTROL_ID,name:"Movie Mentor Operations Scope Isolation Control",version:VERSION,contractVersion:CONTRACT_VERSION,status:"standalone-dormant-not-wired",authority:AUTHORITY,deterministicControl:true,aiAgent:false,
  boundaries:["incident","environment","service","region","project","creator-session","correlation"],
  requirements:["canonical-scope-fingerprint","exact-scope-match-before-evidence-use","trusted-external-scope-attestation-and-reference","source-runtime-identity-and-evidence-reference"],
  restrictions:["cannot-mix-cross-incident-evidence","cannot-mix-production-and-nonproduction-evidence","cannot-cross-project-or-creator-session-boundaries","cannot-trust-self-asserted-scope-without-external-attestation","cannot-grant-operational-authority","no-live-persistence-or-runtime-adapters"],
}}

export{VERSION as OPERATIONS_SCOPE_ISOLATION_VERSION,CONTRACT_VERSION as OPERATIONS_SCOPE_ISOLATION_CONTRACT_VERSION,CONTROL_ID as OPERATIONS_SCOPE_ISOLATION_CONTROL_ID,AUTHORITY as OPERATIONS_SCOPE_ISOLATION_AUTHORITY,createOperationsScope,validateOperationsScope,compareOperationsScopes,createScopedEvidenceEnvelope,validateScopedEvidenceEnvelope,verifyScopedEvidenceEnvelope,getOperationsScopeIsolationControlManifest};
export default validateScopedEvidenceEnvelope;
