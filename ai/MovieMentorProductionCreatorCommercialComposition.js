import {createMovieMentorCreatorCommercialRequestAuthority} from "./MovieMentorCreatorCommercialRequestAuthority.js";
import {createMovieMentorCommercialRouter} from "../movieMentorCommercial.js";
import {isMovieMentorProductionAuthenticationOwnerProof} from "./MovieMentorProductionAuthenticationComposition.js";
import {isMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedProof} from "./MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {isMovieMentorProductionCommercialCheckoutAuthorityOwnedProof} from "./MovieMentorProductionCommercialCheckoutComposition.js";
import {isMovieMentorProductionCommercialPackageCatalogueAuthorityOwnedProof} from "./MovieMentorProductionCommercialPolicyComposition.js";

const VERSION="1.7.0";
const DOMAIN="iband.movie-mentor.production-creator-commercial-composition";
const AUTH_DOMAIN="iband.movie-mentor.production-authentication-composition";
const PURCHASE_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const CHECKOUT_DOMAIN="iband.movie-mentor.production-commercial-checkout-authority";
const CATALOGUE_DOMAIN="iband.movie-mentor.production-commercial-package-catalogue-authority";
const productionCreatorCommercialProofs=new WeakMap();
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function text(value){return typeof value==="string"?value.trim():"";}
function ownedStatus(authority){if(typeof authority?.getStatus!=="function")return null;try{const status=authority.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function authenticationProven(authentication,status){return isMovieMentorProductionAuthenticationOwnerProof(authentication,status)&&status?.domain===AUTH_DOMAIN&&status?.production===true&&status?.ready===true&&status?.provider==="clerk"&&status?.ownerBoundAuthentication===true&&status?.pinnedPublicKeyVerifierRequired===true&&status?.verifier===authentication?.verifier&&status?.verifyCredential===authentication?.verifyCredential&&status?.expectedIssuer===authentication?.expectedIssuer&&status?.expectedAudience===authentication?.expectedAudience&&status?.verifierAlgorithm==="RS256"&&status?.verifierNetworkMode==="pinned-public-key"&&status?.processLocalFallback===false;}
function purchaseProven(authority,status){return isMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedProof(authority,status)&&status?.domain===PURCHASE_DOMAIN&&status?.production===true&&status?.durablePurchaseIntent===true&&status?.immutableCommercialTerms===true&&status?.serverOwnedPolicy===true&&status?.ownerBoundProof===true&&status?.processLocalFallback===false;}
function checkoutProven(authority,status){return isMovieMentorProductionCommercialCheckoutAuthorityOwnedProof(authority,status)&&status?.domain===CHECKOUT_DOMAIN&&status?.production===true&&status?.durableCheckoutBinding===true&&status?.serverOwnedIdempotency===true&&status?.purchaseIntentProvenanceRequired===true&&status?.purchaseIntentOwnerProofRequired===true&&status?.explicitProviderRequired===true&&status?.ownerBoundProof===true&&status?.processLocalFallback===false;}
function catalogueProven(authority,status){return isMovieMentorProductionCommercialPackageCatalogueAuthorityOwnedProof(authority,status)&&status?.domain===CATALOGUE_DOMAIN&&status?.production===true&&status?.serverOwned===true&&status?.creatorMutable===false&&status?.immutableSnapshotRequired===true&&status?.ownerBoundProof===true&&Boolean(text(status?.configurationSource))&&status?.processLocalFallback===false;}
function getMovieMentorProductionCreatorCommercialOwnerStatus(composition){const expected=productionCreatorCommercialProofs.get(composition)||null;if(!expected)return null;const actual=ownedStatus(composition);return actual===expected?expected:null;}
function isMovieMentorProductionCreatorCommercialOwnerProof(composition,status=null){const expected=getMovieMentorProductionCreatorCommercialOwnerStatus(composition);return expected!==null&&(status===null||status===expected);}
function createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority,checkoutAuthority,packageCatalogueAuthority}={}){
  const authenticationStatus=ownedStatus(authentication);
  if(!authenticationProven(authentication,authenticationStatus))fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_AUTHENTICATION_REQUIRED","Production creator commercial composition requires exact owner-proven production authentication.");
  const purchaseStatus=ownedStatus(purchaseIntentAuthority);
  if(typeof purchaseIntentAuthority?.createPurchaseIntent!=="function"||!purchaseProven(purchaseIntentAuthority,purchaseStatus))fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_PURCHASE_INTENT_REQUIRED","Production creator commercial composition requires exact owner-proven production purchase-intent authority.");
  const checkoutStatus=ownedStatus(checkoutAuthority);
  if(typeof checkoutAuthority?.initiateCheckout!=="function"||!checkoutProven(checkoutAuthority,checkoutStatus))fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_CHECKOUT_REQUIRED","Production creator commercial composition requires exact owner-proven production checkout initiation authority.");
  const catalogueStatus=ownedStatus(packageCatalogueAuthority);
  if(typeof packageCatalogueAuthority?.listCommercialPackages!=="function"||!catalogueProven(packageCatalogueAuthority,catalogueStatus))fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_PACKAGE_CATALOGUE_REQUIRED","Production creator commercial composition requires exact owner-proven server-owned package catalogue authority.");
  const requestAuthority=createMovieMentorCreatorCommercialRequestAuthority({verifyCredential:authentication.verifyCredential,expectedIssuer:authentication.expectedIssuer,expectedAudience:authentication.expectedAudience});
  const router=createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,checkoutAuthority,listCommercialPackages:packageCatalogueAuthority.listCommercialPackages});
  const status=Object.freeze({version:VERSION,domain:DOMAIN,production:true,authenticatedCreatorPrincipalRequired:true,authenticationProvenanceRequired:true,authenticationDomain:authentication.domain,authenticationProvider:authentication.provider,authenticationVerifierVersion:authentication.verifierVersion,authenticationVerifierDomain:authentication.verifierDomain,authenticationStatus,purchaseIntentProvenanceRequired:true,purchaseIntentOwnerProofRequired:true,purchaseIntentStatus:purchaseStatus,checkoutProvenanceRequired:true,checkoutOwnerProofRequired:true,checkoutStatus,packageCatalogueProvenanceRequired:true,packageCatalogueOwnerProofRequired:true,catalogueStatus,publicRouteCandidate:true,ownerBoundProof:true,processLocalFallback:false});
  const composition=Object.freeze({version:VERSION,ready:true,requestAuthority,router,publicRouteCandidate:true,mounted:false,authenticationDomain:authentication.domain,authenticationStatus,purchaseIntentStatus:purchaseStatus,checkoutStatus,catalogueStatus,status,getStatus:()=>status});
  productionCreatorCommercialProofs.set(composition,status);
  return composition;
}
function getMovieMentorProductionCreatorCommercialCompositionStatus(){return Object.freeze({version:VERSION,domain:DOMAIN,authenticatedCreatorPrincipalRequired:true,authenticationProvenanceRequired:true,authenticationOwnerProofRequired:true,projectOwnershipNotRequiredForAccountLevelPurchase:true,durablePurchaseIntentRequired:true,purchaseIntentProvenanceRequired:true,purchaseIntentOwnerProofRequired:true,checkoutAuthorityRequired:true,checkoutProvenanceRequired:true,checkoutOwnerProofRequired:true,serverOwnedPackageCatalogueRequired:true,packageCatalogueProvenanceRequired:true,packageCatalogueOwnerProofRequired:true,runtimeOwnerProofRequired:true,ownerBoundProofRequired:true,mounted:false});}
export{VERSION as MOVIE_MENTOR_PRODUCTION_CREATOR_COMMERCIAL_COMPOSITION_VERSION,DOMAIN as MOVIE_MENTOR_PRODUCTION_CREATOR_COMMERCIAL_COMPOSITION_DOMAIN,createMovieMentorProductionCreatorCommercialComposition,getMovieMentorProductionCreatorCommercialCompositionStatus,getMovieMentorProductionCreatorCommercialOwnerStatus,isMovieMentorProductionCreatorCommercialOwnerProof};
export default createMovieMentorProductionCreatorCommercialComposition;
