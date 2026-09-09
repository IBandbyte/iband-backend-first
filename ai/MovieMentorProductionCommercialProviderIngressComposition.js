import {createMovieMentorCommercialProviderIngressAuthority} from "./MovieMentorCommercialProviderIngressAuthority.js";

const VERSION="1.4.0";
const PURCHASE_INTENT_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const CHECKOUT_DOMAIN="iband.movie-mentor.production-commercial-checkout-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function ownedStatus(authority){if(typeof authority?.getStatus!=="function")return null;try{const status=authority.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function purchaseIntentProven(status){return status?.domain===PURCHASE_INTENT_DOMAIN&&status?.production===true&&status?.durablePurchaseIntent===true&&status?.immutableCommercialTerms===true&&status?.serverOwnedPolicy===true&&status?.processLocalFallback===false;}
function checkoutProven(status){return status?.domain===CHECKOUT_DOMAIN&&status?.production===true&&status?.durableCheckoutBinding===true&&status?.checkoutBindingResolution===true&&status?.serverOwnedIdempotency===true&&status?.purchaseIntentProvenanceRequired===true&&status?.explicitProviderRequired===true&&status?.processLocalFallback===false;}
function issuanceProven(status){return status?.domain===ISSUANCE_DOMAIN&&status?.production===true&&status?.durableAtomicIssuance===true&&status?.evidenceIdentityUnique===true&&status?.issuanceReceiptDurable===true&&status?.processLocalFallback===false;}

function createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,providers={}}={}){
 const purchaseStatus=ownedStatus(purchaseIntentAuthority);
 const checkoutBindingStatus=ownedStatus(checkoutBindingAuthority);
 const issuanceStatus=ownedStatus(issuanceAuthority);
 if(typeof purchaseIntentAuthority?.resolvePurchaseIntent!=="function"||!purchaseIntentProven(purchaseStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED","Production provider ingress requires production-proven durable purchase-intent authority.");
 if(typeof checkoutBindingAuthority?.resolveCheckoutBinding!=="function"||!checkoutProven(checkoutBindingStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_CHECKOUT_BINDING_REQUIRED","Production provider ingress requires production-proven durable checkout-session authority.");
 if(typeof issuanceAuthority?.issueVerifiedEvidence!=="function"||!issuanceProven(issuanceStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED","Production provider ingress requires production-proven durable entitlement issuance authority.");
 const authority=createMovieMentorCommercialProviderIngressAuthority({providers,purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority});
 const authorityStatus=ownedStatus(authority);
 return Object.freeze({ready:true,authority,authorityStatus,providerRegistryStatus:authorityStatus?.providerRegistryStatus||null,configuredProviders:authority.configuredProviders,publicRoute:false,rawBodyBoundaryRequired:true,implicitProvider:false,purchaseIntentStatus:purchaseStatus,checkoutBindingStatus,issuanceStatus});
}

function getMovieMentorProductionCommercialProviderIngressCompositionStatus(){return Object.freeze({version:VERSION,providerNeutral:true,publicRoute:false,rawBodyBoundaryRequired:true,implicitProvider:false,creatorPayloadIsNotPaymentAuthority:true,providerRegistryProvenanceRequired:true,purchaseIntentProvenanceRequired:true,checkoutBindingProvenanceRequired:true,issuanceProvenanceRequired:true});}

export{VERSION as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_PROVIDER_INGRESS_COMPOSITION_VERSION,createMovieMentorProductionCommercialProviderIngressComposition,getMovieMentorProductionCommercialProviderIngressCompositionStatus};
export default createMovieMentorProductionCommercialProviderIngressComposition;
