import {createMovieMentorCommercialProviderIngressAuthority} from "./MovieMentorCommercialProviderIngressAuthority.js";

const VERSION="1.3.0";
const PURCHASE_INTENT_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function ownedStatus(authority){if(typeof authority?.getStatus!=="function")return null;try{const status=authority.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function purchaseIntentProven(status){return status?.domain===PURCHASE_INTENT_DOMAIN&&status?.production===true&&status?.durablePurchaseIntent===true&&status?.immutableCommercialTerms===true&&status?.serverOwnedPolicy===true&&status?.processLocalFallback===false;}
function issuanceProven(status){return status?.domain===ISSUANCE_DOMAIN&&status?.production===true&&status?.durableAtomicIssuance===true&&status?.evidenceIdentityUnique===true&&status?.issuanceReceiptDurable===true&&status?.processLocalFallback===false;}

function createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority,issuanceAuthority,providers={}}={}){
 const purchaseStatus=ownedStatus(purchaseIntentAuthority);
 const issuanceStatus=ownedStatus(issuanceAuthority);
 if(typeof purchaseIntentAuthority?.resolvePurchaseIntent!=="function"||!purchaseIntentProven(purchaseStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED","Production provider ingress requires production-proven durable purchase-intent authority.");
 if(typeof issuanceAuthority?.issueVerifiedEvidence!=="function"||!issuanceProven(issuanceStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED","Production provider ingress requires production-proven durable entitlement issuance authority.");
 const authority=createMovieMentorCommercialProviderIngressAuthority({providers,purchaseIntentAuthority,issuanceAuthority});
 const authorityStatus=ownedStatus(authority);
 return Object.freeze({ready:true,authority,authorityStatus,providerRegistryStatus:authorityStatus?.providerRegistryStatus||null,configuredProviders:authority.configuredProviders,publicRoute:false,rawBodyBoundaryRequired:true,implicitProvider:false,purchaseIntentStatus:purchaseStatus,issuanceStatus});
}

function getMovieMentorProductionCommercialProviderIngressCompositionStatus(){return Object.freeze({version:VERSION,providerNeutral:true,publicRoute:false,rawBodyBoundaryRequired:true,implicitProvider:false,creatorPayloadIsNotPaymentAuthority:true,providerRegistryProvenanceRequired:true,purchaseIntentProvenanceRequired:true,issuanceProvenanceRequired:true});}

export{VERSION as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_PROVIDER_INGRESS_COMPOSITION_VERSION,createMovieMentorProductionCommercialProviderIngressComposition,getMovieMentorProductionCommercialProviderIngressCompositionStatus};
export default createMovieMentorProductionCommercialProviderIngressComposition;
