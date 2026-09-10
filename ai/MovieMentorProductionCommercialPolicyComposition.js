import {createMovieMentorCommercialPolicyRegistry} from "./MovieMentorCommercialPolicyRegistry.js";

const VERSION="1.3.0";
const DOMAIN="iband.movie-mentor.production-commercial-policy";
const CATALOGUE_DOMAIN="iband.movie-mentor.production-commercial-package-catalogue-authority";
const ENV_KEY="MOVIE_MENTOR_COMMERCIAL_POLICY_JSON";
const productionCatalogueProofs=new WeakMap();
function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function ownedStatus(authority){if(typeof authority?.getStatus!=="function")return null;try{const status=authority.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function catalogueProven(status){return status?.domain===CATALOGUE_DOMAIN&&status?.production===true&&status?.serverOwned===true&&status?.creatorMutable===false&&status?.immutableSnapshotRequired===true&&status?.configurationSource===ENV_KEY&&status?.processLocalFallback===false;}
function productionCatalogueStatus(sourceStatus){return Object.freeze({version:VERSION,domain:CATALOGUE_DOMAIN,production:true,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,configurationSource:ENV_KEY,sourceCatalogueProvenanceRequired:true,sourceCatalogueStatus:sourceStatus,ownerBoundProof:true,processLocalFallback:false});}
function getMovieMentorProductionCommercialPackageCatalogueAuthorityOwnedStatus(authority){const expected=productionCatalogueProofs.get(authority)||null;if(!expected)return null;const actual=ownedStatus(authority);return actual===expected?expected:null;}
function isMovieMentorProductionCommercialPackageCatalogueAuthorityOwnedProof(authority,status=null){const expected=getMovieMentorProductionCommercialPackageCatalogueAuthorityOwnedStatus(authority);return expected!==null&&(status===null||status===expected);}

function createMovieMentorProductionCommercialPolicyComposition({env=process.env}={}){
  const raw=text(env?.[ENV_KEY]);
  if(!raw)return Object.freeze({version:VERSION,domain:DOMAIN,ready:false,reason:"commercial-policy-not-configured",authority:null,catalogueAuthority:null,configuredPackageIds:Object.freeze([])});
  let policies;
  try{policies=JSON.parse(raw);}catch{fail("MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_INVALID","MOVIE_MENTOR_COMMERCIAL_POLICY_JSON must contain valid JSON.");}
  if(!Array.isArray(policies)||policies.length===0)fail("MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_INVALID","MOVIE_MENTOR_COMMERCIAL_POLICY_JSON must be a non-empty array of package policies.");
  const authority=createMovieMentorCommercialPolicyRegistry({policies,configurationSource:ENV_KEY});
  const sourceCatalogueAuthority=authority.catalogueAuthority;
  const sourceCatalogueStatus=ownedStatus(sourceCatalogueAuthority);
  if(typeof sourceCatalogueAuthority?.listCommercialPackages!=="function"||!catalogueProven(sourceCatalogueStatus))fail("MOVIE_MENTOR_COMMERCIAL_PACKAGE_CATALOGUE_CAPABILITY_NOT_PROVEN","Commercial policy registry must own exact package-catalogue capability proof.");
  const catalogueStatus=productionCatalogueStatus(sourceCatalogueStatus);
  const catalogueAuthority=Object.freeze({listCommercialPackages:sourceCatalogueAuthority.listCommercialPackages,getStatus:()=>catalogueStatus});
  productionCatalogueProofs.set(catalogueAuthority,catalogueStatus);
  return Object.freeze({version:VERSION,domain:DOMAIN,ready:true,authority,resolveCommercialPolicy:authority.resolveCommercialPolicy,listCommercialPackages:catalogueAuthority.listCommercialPackages,catalogueAuthority,catalogueStatus,sourceCatalogueStatus,configuredPackageIds:authority.configuredPackageIds,configurationSource:ENV_KEY,creatorMutable:false});
}

function getMovieMentorProductionCommercialPolicyCompositionStatus({env=process.env}={}){return Object.freeze({version:VERSION,domain:DOMAIN,configured:Boolean(text(env?.[ENV_KEY])),configurationSource:ENV_KEY,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,catalogueCapabilityOwner:DOMAIN,catalogueOwnerProofRequired:true});}

export{VERSION as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_POLICY_COMPOSITION_VERSION,DOMAIN as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_POLICY_COMPOSITION_DOMAIN,CATALOGUE_DOMAIN as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_PACKAGE_CATALOGUE_AUTHORITY_DOMAIN,ENV_KEY as MOVIE_MENTOR_COMMERCIAL_POLICY_ENV_KEY,createMovieMentorProductionCommercialPolicyComposition,getMovieMentorProductionCommercialPolicyCompositionStatus,getMovieMentorProductionCommercialPackageCatalogueAuthorityOwnedStatus,isMovieMentorProductionCommercialPackageCatalogueAuthorityOwnedProof};
export default createMovieMentorProductionCommercialPolicyComposition;
