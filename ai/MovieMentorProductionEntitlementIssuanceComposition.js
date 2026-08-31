import {createMovieMentorEntitlementIssuanceAuthority} from "./MovieMentorEntitlementIssuanceAuthority.js";
import {createMovieMentorEntitlementIssuanceMongoStore,getMovieMentorEntitlementIssuanceMongoStoreStatus} from "./MovieMentorEntitlementIssuanceMongoStore.js";

const VERSION="1.2.0";
const ATOMICITY="mongo-transaction";
const ENTITLEMENT_COLLECTION="movie_mentor_inference_entitlement";
const ISSUANCE_COLLECTION="movie_mentor_entitlement_issuance";
const AUTHORITY_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";

function ownedStatus(store){if(typeof store?.getStatus!=="function")return null;try{const status=store.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function capabilityProven(status){return status?.configured===true&&status?.atomicity===ATOMICITY&&status?.entitlementCollection===ENTITLEMENT_COLLECTION&&status?.issuanceCollection===ISSUANCE_COLLECTION&&status?.evidenceIdentityUnique===true&&status?.entitlementMutationAtomic===true&&status?.issuanceReceiptDurable===true&&status?.processLocalFallback===false;}
function authorityStatus(){return Object.freeze({version:VERSION,domain:AUTHORITY_DOMAIN,production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false});}
function rejected(reason,status){return Object.freeze({ready:false,reason,version:VERSION,authority:null,storeStatus:status});}

function createMovieMentorProductionEntitlementIssuanceComposition({store=null,allowedEvidenceSources=null,allowedEvidenceKinds=null}={}){
 const injectedStore=Boolean(store);
 const status=injectedStore?ownedStatus(store):getMovieMentorEntitlementIssuanceMongoStoreStatus();
 if(injectedStore&&!capabilityProven(status))return rejected("entitlement-issuance-injected-capability-not-proven",status);
 if(status?.configured!==true)return rejected("entitlement-issuance-store-not-configured",status);
 if(!capabilityProven(status))return rejected("entitlement-issuance-capability-not-proven",status);
 try{
  const durableStore=store||createMovieMentorEntitlementIssuanceMongoStore();
  const rawAuthority=createMovieMentorEntitlementIssuanceAuthority({store:durableStore,allowedEvidenceSources,allowedEvidenceKinds});
  const authority=Object.freeze({issueVerifiedEvidence:rawAuthority.issueVerifiedEvidence,getStatus:authorityStatus});
  return Object.freeze({ready:true,reason:"durable-entitlement-issuance-authority-composed",version:VERSION,authority,authorityStatus:authorityStatus(),storeStatus:status});
 }catch(error){return rejected(error?.code||"entitlement-issuance-composition-failed",status);}
}

export{VERSION as MOVIE_MENTOR_PRODUCTION_ENTITLEMENT_ISSUANCE_COMPOSITION_VERSION,AUTHORITY_DOMAIN as MOVIE_MENTOR_PRODUCTION_ENTITLEMENT_ISSUANCE_AUTHORITY_DOMAIN,createMovieMentorProductionEntitlementIssuanceComposition};
export default createMovieMentorProductionEntitlementIssuanceComposition;
