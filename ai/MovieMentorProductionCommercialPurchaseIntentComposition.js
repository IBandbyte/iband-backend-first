import {createMovieMentorCommercialPurchaseIntentMongoStore,getMovieMentorCommercialPurchaseIntentMongoStoreStatus} from "./MovieMentorCommercialPurchaseIntentMongoStore.js";
import {createMovieMentorCommercialPurchaseIntentAuthority} from "./MovieMentorCommercialPurchaseIntentAuthority.js";

const VERSION="1.3.0";
const AUTHORITY_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const productionAuthorityProofs=new WeakMap();
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function ownedStatus(authority){if(typeof authority?.getStatus!=="function")return null;try{const status=authority.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function authorityStatus(){return Object.freeze({version:VERSION,domain:AUTHORITY_DOMAIN,production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,currentPrincipalRevalidationRequired:true,ownerBoundProof:true,processLocalFallback:false});}
function storeCapable(status){return status?.configured===true&&status?.durable===true&&status?.durablePurchaseAttemptRecovery===true&&status?.uniquenessReadinessRequired===true&&status?.processLocalFallback===false;}
function getMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedStatus(authority){const expected=productionAuthorityProofs.get(authority)||null;if(!expected)return null;const actual=ownedStatus(authority);return actual===expected?expected:null;}
function isMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedProof(authority,status=null){const expected=getMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedStatus(authority);return expected!==null&&(status===null||status===expected);}
function createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy}={}){
 const status=getMovieMentorCommercialPurchaseIntentMongoStoreStatus();
 if(!storeCapable(status))fail("MOVIE_MENTOR_PURCHASE_INTENT_STORE_NOT_CONFIGURED","Production purchase-intent authority requires durable Mongo configuration, durable purchase-attempt recovery, and uniqueness-readiness proof.");
 if(typeof resolveCommercialPolicy!=="function")fail("MOVIE_MENTOR_PURCHASE_INTENT_POLICY_REQUIRED","Production purchase-intent composition requires explicit server-owned commercial policy.");
 const store=createMovieMentorCommercialPurchaseIntentMongoStore();
 const rawAuthority=createMovieMentorCommercialPurchaseIntentAuthority({store,resolveCommercialPolicy});
 const productionStatus=authorityStatus();
 const authority=Object.freeze({
  async createPurchaseIntent(input={}){if(typeof input?.currentPrincipalAuthority!=="function")fail("MOVIE_MENTOR_PURCHASE_INTENT_CURRENT_PRINCIPAL_AUTHORITY_REQUIRED","Production purchase-intent minting requires current principal revalidation immediately before the durable write.");return rawAuthority.createPurchaseIntent(input);},
  resolvePurchaseIntent:rawAuthority.resolvePurchaseIntent,
  getStatus:()=>productionStatus
 });
 productionAuthorityProofs.set(authority,productionStatus);
 return Object.freeze({ready:true,store,authority,resolvePurchaseIntent:authority.resolvePurchaseIntent,authorityStatus:productionStatus});
}
function getMovieMentorProductionCommercialPurchaseIntentCompositionStatus(){const store=getMovieMentorCommercialPurchaseIntentMongoStoreStatus();return Object.freeze({version:VERSION,configured:store.configured,readiness:storeCapable(store)?"policy-required-at-composition":"configuration-required",publicRoute:false,checkoutProvider:false,authorityCapability:authorityStatus()});}
export{VERSION as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_PURCHASE_INTENT_COMPOSITION_VERSION,AUTHORITY_DOMAIN as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_PURCHASE_INTENT_AUTHORITY_DOMAIN,createMovieMentorProductionCommercialPurchaseIntentComposition,getMovieMentorProductionCommercialPurchaseIntentCompositionStatus,getMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedStatus,isMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedProof};export default createMovieMentorProductionCommercialPurchaseIntentComposition;
