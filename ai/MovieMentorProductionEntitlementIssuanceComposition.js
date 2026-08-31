import {createMovieMentorEntitlementIssuanceAuthority} from "./MovieMentorEntitlementIssuanceAuthority.js";
import {createMovieMentorEntitlementIssuanceMongoStore,getMovieMentorEntitlementIssuanceMongoStoreStatus} from "./MovieMentorEntitlementIssuanceMongoStore.js";

const VERSION="1.4.0";
const ATOMICITY="mongo-transaction";
const ENTITLEMENT_COLLECTION="movie_mentor_inference_entitlement";
const ISSUANCE_COLLECTION="movie_mentor_entitlement_issuance";
const STORE_DOMAIN="iband.movie-mentor.entitlement-issuance-store";
const SOURCE_AUTHORITY_DOMAIN="iband.movie-mentor.entitlement-issuance-authority";
const AUTHORITY_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";
const productionAuthorityProofs=new WeakMap();

function ownedStatus(target){if(typeof target?.getStatus!=="function")return null;try{const status=target.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function capabilityProven(status){return status?.domain===STORE_DOMAIN&&status?.configured===true&&status?.atomicity===ATOMICITY&&status?.entitlementCollection===ENTITLEMENT_COLLECTION&&status?.issuanceCollection===ISSUANCE_COLLECTION&&status?.evidenceIdentityUnique===true&&status?.entitlementMutationAtomic===true&&status?.issuanceReceiptDurable===true&&status?.processLocalFallback===false;}
function sourceAuthorityProven(status){return status?.domain===SOURCE_AUTHORITY_DOMAIN&&status?.durableAtomicIssuance===true&&status?.evidenceIdentityUnique===true&&status?.entitlementMutationAtomic===true&&status?.issuanceReceiptDurable===true&&status?.storeCapabilityProven===true&&status?.storeStatus?.domain===STORE_DOMAIN&&status?.processLocalFallback===false;}
function productionAuthorityStatus(sourceAuthorityStatus){return Object.freeze({version:VERSION,domain:AUTHORITY_DOMAIN,production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,sourceAuthorityProvenanceRequired:true,sourceAuthorityStatus,ownerBoundProof:true,processLocalFallback:false});}
function rejected(reason,status,sourceAuthorityStatus=null){return Object.freeze({ready:false,reason,version:VERSION,authority:null,storeStatus:status,sourceAuthorityStatus});}
function getMovieMentorProductionEntitlementIssuanceAuthorityOwnedStatus(authority){
 const expected=productionAuthorityProofs.get(authority)||null;
 if(!expected)return null;
 const actual=ownedStatus(authority);
 return actual===expected?expected:null;
}
function isMovieMentorProductionEntitlementIssuanceAuthorityOwnedProof(authority,status=null){
 const expected=getMovieMentorProductionEntitlementIssuanceAuthorityOwnedStatus(authority);
 return expected!==null&&(status===null||status===expected);
}

function createMovieMentorProductionEntitlementIssuanceComposition({store=null,allowedEvidenceSources=null,allowedEvidenceKinds=null}={}){
 const injectedStore=Boolean(store);
 const status=injectedStore?ownedStatus(store):getMovieMentorEntitlementIssuanceMongoStoreStatus();
 if(injectedStore&&!capabilityProven(status))return rejected("entitlement-issuance-injected-capability-not-proven",status);
 if(status?.configured!==true)return rejected("entitlement-issuance-store-not-configured",status);
 if(!capabilityProven(status))return rejected("entitlement-issuance-capability-not-proven",status);
 try{
  const durableStore=store||createMovieMentorEntitlementIssuanceMongoStore();
  const rawAuthority=createMovieMentorEntitlementIssuanceAuthority({store:durableStore,allowedEvidenceSources,allowedEvidenceKinds});
  const sourceAuthorityStatus=ownedStatus(rawAuthority);
  if(!sourceAuthorityProven(sourceAuthorityStatus))return rejected("entitlement-issuance-authority-provenance-not-proven",status,sourceAuthorityStatus);
  const authorityStatus=productionAuthorityStatus(sourceAuthorityStatus);
  const getStatus=()=>authorityStatus;
  const authority=Object.freeze({issueVerifiedEvidence:rawAuthority.issueVerifiedEvidence,getStatus});
  productionAuthorityProofs.set(authority,authorityStatus);
  return Object.freeze({ready:true,reason:"durable-entitlement-issuance-authority-composed",version:VERSION,authority,authorityStatus,sourceAuthorityStatus,storeStatus:status});
 }catch(error){return rejected(error?.code||"entitlement-issuance-composition-failed",status);}
}

export{VERSION as MOVIE_MENTOR_PRODUCTION_ENTITLEMENT_ISSUANCE_COMPOSITION_VERSION,AUTHORITY_DOMAIN as MOVIE_MENTOR_PRODUCTION_ENTITLEMENT_ISSUANCE_AUTHORITY_DOMAIN,createMovieMentorProductionEntitlementIssuanceComposition,getMovieMentorProductionEntitlementIssuanceAuthorityOwnedStatus,isMovieMentorProductionEntitlementIssuanceAuthorityOwnedProof};
export default createMovieMentorProductionEntitlementIssuanceComposition;
