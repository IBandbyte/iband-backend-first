const VERSION="1.1.0";
const DOMAIN="iband.movie-mentor.entitlement-issuance-authority";
const STORE_DOMAIN="iband.movie-mentor.entitlement-issuance-store";
const ATOMICITY="mongo-transaction";
const ENTITLEMENT_COLLECTION="movie_mentor_inference_entitlement";
const ISSUANCE_COLLECTION="movie_mentor_entitlement_issuance";
function text(v){return typeof v==="string"?v.trim():"";}
function positive(v){return Number.isSafeInteger(v)&&v>0?v:null;}
function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}
function normalizeEvidence(e={}){return Object.freeze({verified:e.verified===true,evidenceId:text(e.evidenceId),evidenceSource:text(e.evidenceSource),evidenceKind:text(e.evidenceKind),principalId:text(e.principalId),units:positive(e.units),commercialReference:text(e.commercialReference),evidenceDigest:text(e.evidenceDigest),verifiedAt:text(e.verifiedAt)});}
function ownedStatus(store){if(typeof store?.getStatus!=="function")return null;try{const status=store.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function storeCapabilityProven(status){return status?.domain===STORE_DOMAIN&&status?.configured===true&&status?.atomicity===ATOMICITY&&status?.entitlementCollection===ENTITLEMENT_COLLECTION&&status?.issuanceCollection===ISSUANCE_COLLECTION&&status?.evidenceIdentityUnique===true&&status?.entitlementMutationAtomic===true&&status?.issuanceReceiptDurable===true&&status?.processLocalFallback===false;}
function createMovieMentorEntitlementIssuanceAuthority({store=null,allowedEvidenceSources=null,allowedEvidenceKinds=null}={}){
 if(typeof store?.issue!=="function")fail("MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_AUTHORITY_REQUIRED","Entitlement issuance requires a durable atomic issuance store.");
 const storeStatus=ownedStatus(store);
 if(!storeCapabilityProven(storeStatus))fail("MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_STORE_CAPABILITY_NOT_PROVEN","Entitlement issuance requires exact store-owned durable atomic issuance capability proof.");
 const sources=allowedEvidenceSources?new Set(allowedEvidenceSources.map(text).filter(Boolean)):null;
 const kinds=allowedEvidenceKinds?new Set(allowedEvidenceKinds.map(text).filter(Boolean)):null;
 async function issueVerifiedEvidence({evidence=null}={}){
  const n=normalizeEvidence(evidence||{});
  if(n.verified!==true)fail("MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_EVIDENCE_UNVERIFIED","Verified commercial evidence is required.");
  if(!n.evidenceId||!n.evidenceSource||!n.evidenceKind||!n.principalId||!n.commercialReference||!n.evidenceDigest||!n.verifiedAt||!n.units)fail("MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_EVIDENCE_INVALID","Verified issuance evidence is incomplete or malformed.");
  if(sources&&!sources.has(n.evidenceSource))fail("MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_SOURCE_UNSUPPORTED","Evidence source is not authorised for entitlement issuance.");
  if(kinds&&!kinds.has(n.evidenceKind))fail("MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_KIND_UNSUPPORTED","Evidence kind is not authorised for entitlement issuance.");
  const decision=await store.issue(n);
  if(decision?.issued!==true)fail("MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_DENIED","Durable entitlement issuance was denied.",{reason:decision?.reason||"issuance-denied"});
  const r=decision.receipt;
  if(!r||text(r.evidenceId)!==n.evidenceId||text(r.evidenceSource)!==n.evidenceSource||text(r.principalId)!==n.principalId||r.units!==n.units||text(r.commercialReference)!==n.commercialReference||text(r.evidenceDigest)!==n.evidenceDigest||text(r.status)!=="issued")fail("MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_RECEIPT_INVALID","Durable issuance receipt does not bind verified commercial evidence.");
  return Object.freeze({authorized:true,domain:DOMAIN,issuanceId:text(r.issuanceId),evidenceId:n.evidenceId,evidenceSource:n.evidenceSource,principalId:n.principalId,units:n.units,entitlementRevision:r.entitlementRevisionAfter??null,idempotent:decision.idempotent===true});
 }
 const status=Object.freeze({version:VERSION,domain:DOMAIN,durableAtomicIssuance:true,evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,storeCapabilityProven:true,storeStatus,processLocalFallback:false});
 return Object.freeze({issueVerifiedEvidence,getStatus:()=>status});
}
export{VERSION as MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_AUTHORITY_VERSION,DOMAIN as MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_AUTHORITY_DOMAIN,createMovieMentorEntitlementIssuanceAuthority};
export default createMovieMentorEntitlementIssuanceAuthority;
