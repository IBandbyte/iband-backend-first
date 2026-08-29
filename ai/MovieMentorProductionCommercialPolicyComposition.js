import {createMovieMentorCommercialPolicyRegistry} from "./MovieMentorCommercialPolicyRegistry.js";

const ENV_KEY="MOVIE_MENTOR_COMMERCIAL_POLICY_JSON";
function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}

function createMovieMentorProductionCommercialPolicyComposition({env=process.env}={}){
  const raw=text(env?.[ENV_KEY]);
  if(!raw)return Object.freeze({ready:false,reason:"commercial-policy-not-configured",authority:null,configuredPackageIds:Object.freeze([])});
  let policies;
  try{policies=JSON.parse(raw);}catch{fail("MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_INVALID","MOVIE_MENTOR_COMMERCIAL_POLICY_JSON must contain valid JSON.");}
  if(!Array.isArray(policies)||policies.length===0)fail("MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_INVALID","MOVIE_MENTOR_COMMERCIAL_POLICY_JSON must be a non-empty array of package policies.");
  const authority=createMovieMentorCommercialPolicyRegistry({policies});
  return Object.freeze({ready:true,authority,resolveCommercialPolicy:authority.resolveCommercialPolicy,listCommercialPackages:authority.listCommercialPackages,configuredPackageIds:authority.configuredPackageIds,configurationSource:ENV_KEY,creatorMutable:false});
}

function getMovieMentorProductionCommercialPolicyCompositionStatus({env=process.env}={}){return Object.freeze({configured:Boolean(text(env?.[ENV_KEY])),configurationSource:ENV_KEY,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true});}

export{ENV_KEY as MOVIE_MENTOR_COMMERCIAL_POLICY_ENV_KEY,createMovieMentorProductionCommercialPolicyComposition,getMovieMentorProductionCommercialPolicyCompositionStatus};
export default createMovieMentorProductionCommercialPolicyComposition;
