import {createMovieMentorCommercialPolicyRegistry} from "./MovieMentorCommercialPolicyRegistry.js";

const VERSION="1.1.0";
const DOMAIN="iband.movie-mentor.production-commercial-policy";
const CATALOGUE_DOMAIN="iband.movie-mentor.production-commercial-package-catalogue-authority";
const ENV_KEY="MOVIE_MENTOR_COMMERCIAL_POLICY_JSON";
function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function catalogueStatus(){return Object.freeze({version:VERSION,domain:CATALOGUE_DOMAIN,production:true,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,configurationSource:ENV_KEY});}

function createMovieMentorProductionCommercialPolicyComposition({env=process.env}={}){
  const raw=text(env?.[ENV_KEY]);
  if(!raw)return Object.freeze({version:VERSION,domain:DOMAIN,ready:false,reason:"commercial-policy-not-configured",authority:null,catalogueAuthority:null,configuredPackageIds:Object.freeze([])});
  let policies;
  try{policies=JSON.parse(raw);}catch{fail("MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_INVALID","MOVIE_MENTOR_COMMERCIAL_POLICY_JSON must contain valid JSON.");}
  if(!Array.isArray(policies)||policies.length===0)fail("MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_INVALID","MOVIE_MENTOR_COMMERCIAL_POLICY_JSON must be a non-empty array of package policies.");
  const authority=createMovieMentorCommercialPolicyRegistry({policies});
  const catalogueAuthority=Object.freeze({listCommercialPackages:authority.listCommercialPackages,getStatus:catalogueStatus});
  return Object.freeze({version:VERSION,domain:DOMAIN,ready:true,authority,resolveCommercialPolicy:authority.resolveCommercialPolicy,listCommercialPackages:authority.listCommercialPackages,catalogueAuthority,catalogueStatus:catalogueStatus(),configuredPackageIds:authority.configuredPackageIds,configurationSource:ENV_KEY,creatorMutable:false});
}

function getMovieMentorProductionCommercialPolicyCompositionStatus({env=process.env}={}){return Object.freeze({version:VERSION,domain:DOMAIN,configured:Boolean(text(env?.[ENV_KEY])),configurationSource:ENV_KEY,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,catalogueCapability:catalogueStatus()});}

export{VERSION as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_POLICY_COMPOSITION_VERSION,DOMAIN as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_POLICY_COMPOSITION_DOMAIN,CATALOGUE_DOMAIN as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_PACKAGE_CATALOGUE_AUTHORITY_DOMAIN,ENV_KEY as MOVIE_MENTOR_COMMERCIAL_POLICY_ENV_KEY,createMovieMentorProductionCommercialPolicyComposition,getMovieMentorProductionCommercialPolicyCompositionStatus};
export default createMovieMentorProductionCommercialPolicyComposition;
