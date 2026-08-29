import {createMovieMentorCreatorCommercialRequestAuthority} from "./MovieMentorCreatorCommercialRequestAuthority.js";
import {createMovieMentorCommercialRouter} from "../movieMentorCommercial.js";

function fail(code,message){const error=new Error(message);error.code=code;throw error;}

function createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority,checkoutAuthority,listCommercialPackages}={}){
  if(authentication?.ready!==true||typeof authentication.verifyCredential!=="function")fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_AUTHENTICATION_REQUIRED","Production creator commercial composition requires ready production authentication.");
  if(typeof purchaseIntentAuthority?.createPurchaseIntent!=="function")fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_PURCHASE_INTENT_REQUIRED","Production creator commercial composition requires certified purchase-intent authority.");
  if(typeof checkoutAuthority?.initiateCheckout!=="function")fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_CHECKOUT_REQUIRED","Production creator commercial composition requires certified checkout initiation authority.");
  if(typeof listCommercialPackages!=="function")fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_PACKAGE_CATALOGUE_REQUIRED","Production creator commercial composition requires server-owned package catalogue authority.");
  const requestAuthority=createMovieMentorCreatorCommercialRequestAuthority({verifyCredential:authentication.verifyCredential,expectedIssuer:authentication.expectedIssuer,expectedAudience:authentication.expectedAudience});
  const router=createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,checkoutAuthority,listCommercialPackages});
  return Object.freeze({ready:true,requestAuthority,router,publicRouteCandidate:true,mounted:false});
}

function getMovieMentorProductionCreatorCommercialCompositionStatus(){return Object.freeze({authenticatedCreatorPrincipalRequired:true,projectOwnershipNotRequiredForAccountLevelPurchase:true,durablePurchaseIntentRequired:true,checkoutAuthorityRequired:true,serverOwnedPackageCatalogueRequired:true,mounted:false});}

export{createMovieMentorProductionCreatorCommercialComposition,getMovieMentorProductionCreatorCommercialCompositionStatus};
export default createMovieMentorProductionCreatorCommercialComposition;
