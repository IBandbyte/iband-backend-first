/** Movie Mentor Post-Catastrophe Recovery Certification v2.3 core — certify the complete Recovery Authority Digest v2 envelope at the final certificate boundary. */
import certifyLegacy from"./MovieMentorPostCatastropheRecoveryCertificationV22Legacy.js";
import{RECOVERY_AUTHORITY_BINDING_HASH_DOMAIN as DOMAIN,RECOVERY_AUTHORITY_BINDING_HASH_SCHEMA as SCHEMA}from"./MovieMentorRecoveryAuthority.js";
const s=v=>typeof v==="string"?v.trim():"";
const validEnvelope=v=>v?.bindingFingerprintDomain===DOMAIN&&v?.bindingFingerprintSchema===SCHEMA&&/^[a-f0-9]{64}$/i.test(s(v?.bindingFingerprint));
const validDurableEnvelope=v=>v?.bindingFingerprintDomain===DOMAIN&&v?.bindingFingerprintSchema===SCHEMA&&/^[a-f0-9]{64}$/i.test(s(v?.bindingFingerprint));
async function certifyV23(args={},deps={}){
 let authorityDecision=null,finalTuple=null,finalDurable=null,reconciledDurable=null;
 const wrapped={...deps};
 if(typeof deps.verifyRecoveryAuthorityDecision==="function")wrapped.verifyRecoveryAuthorityDecision=async payload=>{const r=await deps.verifyRecoveryAuthorityDecision(payload);authorityDecision=r&&typeof r==="object"?structuredClone(r):r;return r};
 if(typeof deps.commitFinalRecovery==="function")wrapped.commitFinalRecovery=async payload=>{finalTuple=payload?.tuple?structuredClone(payload.tuple):null;if(!validEnvelope(finalTuple))return{committed:false,indeterminate:false,reason:"post_catastrophe_certificate_authority_digest_protocol_mismatch"};return deps.commitFinalRecovery(payload)};
 if(typeof deps.readFinalRecovery==="function")wrapped.readFinalRecovery=async payload=>{const r=await deps.readFinalRecovery(payload);finalDurable=r&&typeof r==="object"?structuredClone(r):r;return r};
 if(typeof deps.readFinalRecoveryByIdentity==="function")wrapped.readFinalRecoveryByIdentity=async payload=>{const r=await deps.readFinalRecoveryByIdentity(payload);reconciledDurable=r&&typeof r==="object"?structuredClone(r):r;return r};
 const result=await certifyLegacy(args,wrapped);
 if(result?.certified!==true)return result;
 if(!validEnvelope(authorityDecision)||s(result.recoveryAuthorityBindingFingerprint)!==s(authorityDecision.bindingFingerprint))return{certified:false,status:"certificate_authority_digest_protocol_denied",reasons:["post_catastrophe_certificate_authority_digest_protocol_mismatch"]};
 if(args.finalizationMode!=="reconcile"){
  if(!validEnvelope(finalTuple)||s(finalTuple.bindingFingerprint)!==s(authorityDecision.bindingFingerprint))return{certified:false,status:"certificate_finalization_identity_denied",reasons:["post_catastrophe_certificate_finalization_identity_mismatch"]};
  const h=finalDurable?.authorityHighWatermark,g=finalDurable?.globalState;
  if(!validDurableEnvelope(h)||!validDurableEnvelope(g)||s(h?.bindingFingerprint)!==s(authorityDecision.bindingFingerprint)||s(g?.bindingFingerprint)!==s(authorityDecision.bindingFingerprint))return{certified:false,status:"certificate_durable_authority_envelope_denied",indeterminate:true,reasons:["post_catastrophe_certificate_durable_authority_digest_protocol_mismatch"]};
 }else if(reconciledDurable?.found===true){
  const h=reconciledDurable.authorityHighWatermark,g=reconciledDurable.globalState;
  if(!validDurableEnvelope(h)||!validDurableEnvelope(g)||s(h?.bindingFingerprint)!==s(authorityDecision.bindingFingerprint)||s(g?.bindingFingerprint)!==s(authorityDecision.bindingFingerprint))return{certified:false,status:"certificate_reconciled_authority_envelope_denied",indeterminate:true,reasons:["post_catastrophe_certificate_durable_authority_digest_protocol_mismatch"]};
 }
 return{...result,recoveryAuthorityBindingFingerprintDomain:DOMAIN,recoveryAuthorityBindingFingerprintSchema:SCHEMA};
}
export default certifyV23;
