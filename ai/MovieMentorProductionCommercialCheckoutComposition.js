import {createMovieMentorCommercialCheckoutProviderRegistry} from "./MovieMentorCommercialCheckoutProviderRegistry.js";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "./MovieMentorCommercialCheckoutInitiationAuthority.js";
import {createMovieMentorCommercialCheckoutBindingMongoStore,getMovieMentorCommercialCheckoutBindingMongoStoreStatus} from "./MovieMentorCommercialCheckoutBindingMongoStore.js";

const VERSION="1.4.0";
const PURCHASE_INTENT_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const ENTITLEMENT_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";
const AUTHORITY_DOMAIN="iband.movie-mentor.production-commercial-checkout-authority";
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function ownedStatus(authority){if(typeof authority?.getStatus!=="function")return null;try{const status=authority.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function purchaseIntentProven(status){return status?.domain===PURCHASE_INTENT_DOMAIN&&status?.production===true&&status?.durablePurchaseIntent===true&&status?.immutableCommercialTerms===true&&status?.serverOwnedPolicy===true&&status?.processLocalFallback===false;}
function entitlementProven(status){return status?.domain===ENTITLEMENT_DOMAIN&&status?.production===true&&status?.durableAtomicIssuance===true&&status?.currentEntitlementRead===true&&status?.ownerBoundProof===true&&status?.processLocalFallback===false;}
function checkoutStatus(entitlementStatus){return Object.freeze({version:VERSION,domain:AUTHORITY_DOMAIN,production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,currentEntitlementProvenanceRequired:true,currentEntitlementStatus:entitlementStatus,explicitProviderRequired:true,processLocalFallback:false});}
function createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority,entitlementAuthority,providers={}}={}){
 const purchaseStatus=ownedStatus(purchaseIntentAuthority);
 if(typeof purchaseIntentAuthority?.resolvePurchaseIntent!=="function"||!purchaseIntentProven(purchaseStatus))fail("MOVIE_MENTOR_CHECKOUT_PURCHASE_INTENT_AUTHORITY_REQUIRED","Production checkout requires production-proven durable purchase-intent authority.");
 const entitlementStatus=ownedStatus(entitlementAuthority);
 if(typeof entitlementAuthority?.resolveCurrentEntitlement!=="function"||!entitlementProven(entitlementStatus))fail("MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_AUTHORITY_REQUIRED","Production checkout requires production-proven current durable entitlement authority.");
 const storeStatus=getMovieMentorCommercialCheckoutBindingMongoStoreStatus();
 if(storeStatus?.configured!==true||storeStatus?.durable!==true||storeStatus?.providerPaymentReferenceBinding!==true||storeStatus?.providerPaymentReferenceResolution!==true||storeStatus?.processLocalFallback!==false)fail("MOVIE_MENTOR_CHECKOUT_BINDING_STORE_NOT_CONFIGURED","Production checkout requires durable Mongo-backed checkout and provider-payment binding authority.");
 const registry=createMovieMentorCommercialCheckoutProviderRegistry({providers});
 if(registry.configuredProviders.length===0)fail("MOVIE_MENTOR_CHECKOUT_PROVIDER_NOT_CONFIGURED","Production checkout requires at least one explicit provider adapter; no provider is selected by accident.");
 const checkoutBindingStore=createMovieMentorCommercialCheckoutBindingMongoStore();
 const rawAuthority=createMovieMentorCommercialCheckoutInitiationAuthority({resolvePurchaseIntent:purchaseIntentAuthority.resolvePurchaseIntent,resolveCurrentEntitlement:entitlementAuthority.resolveCurrentEntitlement,createProviderCheckout:registry.createProviderCheckout,checkoutBindingStore});
 const resolveCheckoutBinding=({commercialIntentId}={})=>checkoutBindingStore.resolve({commercialIntentId});
 const bindProviderPaymentReference=({commercialIntentId,provider,checkoutReference,providerPaymentReference}={})=>checkoutBindingStore.bindProviderPaymentReference({commercialIntentId,provider,checkoutReference,providerPaymentReference});
 const resolveCheckoutBindingByProviderPaymentReference=({provider,providerPaymentReference,paymentReference}={})=>checkoutBindingStore.resolveByProviderPaymentReference({provider,providerPaymentReference,paymentReference});
 const status=checkoutStatus(entitlementStatus);
 const authority=Object.freeze({initiateCheckout:rawAuthority.initiateCheckout,resolveCheckoutBinding,bindProviderPaymentReference,resolveCheckoutBindingByProviderPaymentReference,getStatus:()=>status});
 return Object.freeze({ready:true,authority,authorityStatus:status,registry,checkoutBindingStore,publicRoute:false,providerIngress:false,durableCheckoutBinding:true});
}
function getMovieMentorProductionCommercialCheckoutCompositionStatus(){const store=getMovieMentorCommercialCheckoutBindingMongoStoreStatus();return Object.freeze({version:VERSION,providerNeutral:true,publicRoute:false,providerIngress:false,implicitProvider:false,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,currentEntitlementProvenanceRequired:true,configured:store.configured});}
export{VERSION as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_CHECKOUT_COMPOSITION_VERSION,AUTHORITY_DOMAIN as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_CHECKOUT_AUTHORITY_DOMAIN,createMovieMentorProductionCommercialCheckoutComposition,getMovieMentorProductionCommercialCheckoutCompositionStatus};export default createMovieMentorProductionCommercialCheckoutComposition;
