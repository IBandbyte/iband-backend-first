import {createMovieMentorCommercialProviderIngressAuthority} from "./MovieMentorCommercialProviderIngressAuthority.js";

function fail(code,message){const error=new Error(message);error.code=code;throw error;}

function createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority,issuanceAuthority,providers={}}={}){
  if(typeof purchaseIntentAuthority?.resolvePurchaseIntent!=="function")fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED","Production provider ingress requires certified durable purchase-intent authority.");
  if(typeof issuanceAuthority?.issueVerifiedEvidence!=="function")fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED","Production provider ingress requires certified entitlement issuance authority.");
  const authority=createMovieMentorCommercialProviderIngressAuthority({providers,resolvePurchaseIntent:purchaseIntentAuthority.resolvePurchaseIntent,issuanceAuthority});
  return Object.freeze({ready:true,authority,configuredProviders:authority.configuredProviders,publicRoute:false,rawBodyBoundaryRequired:true,implicitProvider:false});
}

function getMovieMentorProductionCommercialProviderIngressCompositionStatus(){
  return Object.freeze({providerNeutral:true,publicRoute:false,rawBodyBoundaryRequired:true,implicitProvider:false,creatorPayloadIsNotPaymentAuthority:true});
}

export{createMovieMentorProductionCommercialProviderIngressComposition,getMovieMentorProductionCommercialProviderIngressCompositionStatus};
export default createMovieMentorProductionCommercialProviderIngressComposition;
