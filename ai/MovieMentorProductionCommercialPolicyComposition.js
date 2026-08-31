import {createMovieMentorCommercialPolicyRegistry} from "./MovieMentorCommercialPolicyRegistry.js";

const VERSION="1.2.0";
const DOMAIN="iband.movie-mentor.production-commercial-policy";
const CATALOGUE_DOMAIN="iband.movie-mentor.production-commercial-package-catalogue-authority";
const ENV_KEY="MOVIE_MENTOR_COMMERCIAL_POLICY_JSON";
function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function ownedStatus(authority){if(typeof authority?.getStatus!=="function")return null;try{const status=authority.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function catalogueProven(status){return status?.domain===CATALOGUE_DOMAIN&&status?.production===true&&status?.serverOwned===true&&status?.creatorMutable===false&&status?.immutableSnapshotRequired===true&&status?.configurationSource===ENV_KEY&&status?.processLocalFallback===false;}

function createMovieMentorProductionCommercialPolicyComposition({env=process.env}={}){
  const raw=text(env?.[ENV_KEY]);
  if(!raw)return Object.freeze({version:VERSION,domain:DOMAIN,ready:false,reason:"commercial-policy-not-configured",authority:null,catalogueAuthority:null,configuredPackageIds:Object.freeze([])});
  let policies;
  try{policies=JSON.parse(raw);}catch{fail("MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_INVALID","MOVIE_MENTOR_COMMERCIAL_POLICY_JSON must contain valid JSON.");}
  if(!Array.isArray(policies)||policies.length===0)fail("MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_INVALID","MOVIE_MENTOR_COMMERCIAL_POLICY_JSON must be a non-empty array of package policies.");
  const authority=createMovieMentorCommercialPolicyRegistry({policies,configurationSource:ENV_KEY});
  const catalogueAuthority=authority.catalogueAuthority;
  const catalogueStatus=ownedStatus(catalogueAuthority);
  if(typeof catalogueAuthority?.listCommercialPackages!=="function"||!catalogueProven(catalogueStatus))fail("MOVIE_MENTOR_COMMERCIAL_PACKAGE_CATALOGUE_CAPABILITY_NOT_PROVEN","Commercial policy registry must own exact package-catalogue capability proof.");
  return Object.freeze({version:VERSION,domain:DOMAIN,ready:true,authority,resolveCommercialPolicy:authority.resolveCommercialPolicy,listCommercialPackages:authority.listCommercialPackages,catalogueAuthority,catalogueStatus,configuredPackageIds:authority.configuredPackageIds,configurationSource:ENV_KEY,creatorMutable:false});
}

function getMovieMentorProductionCommercialPolicyCompositionStatus({env=process.env}={}){return Object.freeze({version:VERSION,domain:DOMAIN,configured:Boolean(text(env?.[ENV_KEY])),configurationSource:ENV_KEY,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,catalogueCapabilityOwner:DOMAIN});}

export{VERSION as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_POLICY_COMPOSITION_VERSION,DOMAIN as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_POLICY_COMPOSITION_DOMAIN,CATALOGUE_DOMAIN as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_PACKAGE_CATALOGUE_AUTHORITY_DOMAIN,ENV_KEY as MOVIE_MENTOR_COMMERCIAL_POLICY_ENV_KEY,createMovieMentorProductionCommercialPolicyComposition,getMovieMentorProductionCommercialPolicyCompositionStatus};
export default createMovieMentorProductionCommercialPolicyComposition;
