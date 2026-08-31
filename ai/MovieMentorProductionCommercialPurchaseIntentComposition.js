import {createMovieMentorCommercialPurchaseIntentMongoStore,getMovieMentorCommercialPurchaseIntentMongoStoreStatus} from "./MovieMentorCommercialPurchaseIntentMongoStore.js";
import {createMovieMentorCommercialPurchaseIntentAuthority} from "./MovieMentorCommercialPurchaseIntentAuthority.js";

const VERSION="1.1.0";
const AUTHORITY_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function authorityStatus(){return Object.freeze({version:VERSION,domain:AUTHORITY_DOMAIN,production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false});}
function storeCapable(status){return status?.configured===true&&status?.durable===true&&status?.processLocalFallback===false;}
function createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy}={}){
 const status=getMovieMentorCommercialPurchaseIntentMongoStoreStatus();
 if(!storeCapable(status))fail("MOVIE_MENTOR_PURCHASE_INTENT_STORE_NOT_CONFIGURED","Production purchase-intent authority requires durable Mongo configuration and store-owned durability proof.");
 if(typeof resolveCommercialPolicy!=="function")fail("MOVIE_MENTOR_PURCHASE_INTENT_POLICY_REQUIRED","Production purchase-intent composition requires explicit server-owned commercial policy.");
 const store=createMovieMentorCommercialPurchaseIntentMongoStore();
 const rawAuthority=createMovieMentorCommercialPurchaseIntentAuthority({store,resolveCommercialPolicy});
 const authority=Object.freeze({createPurchaseIntent:rawAuthority.createPurchaseIntent,resolvePurchaseIntent:rawAuthority.resolvePurchaseIntent,getStatus:authorityStatus});
 return Object.freeze({ready:true,store,authority,resolvePurchaseIntent:authority.resolvePurchaseIntent,authorityStatus:authorityStatus()});
}
function getMovieMentorProductionCommercialPurchaseIntentCompositionStatus(){const store=getMovieMentorCommercialPurchaseIntentMongoStoreStatus();return Object.freeze({version:VERSION,configured:store.configured,readiness:storeCapable(store)?"policy-required-at-composition":"configuration-required",publicRoute:false,checkoutProvider:false,authorityCapability:authorityStatus()});}
export{VERSION as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_PURCHASE_INTENT_COMPOSITION_VERSION,AUTHORITY_DOMAIN as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_PURCHASE_INTENT_AUTHORITY_DOMAIN,createMovieMentorProductionCommercialPurchaseIntentComposition,getMovieMentorProductionCommercialPurchaseIntentCompositionStatus};export default createMovieMentorProductionCommercialPurchaseIntentComposition;
