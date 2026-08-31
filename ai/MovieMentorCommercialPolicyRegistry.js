import crypto from "node:crypto";

const VERSION="1.1.0";
const DOMAIN="iband.movie-mentor.commercial-policy-registry";
const CATALOGUE_DOMAIN="iband.movie-mentor.production-commercial-package-catalogue-authority";
function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function canonical(policy){return Object.freeze({packageId:text(policy.packageId),provider:text(policy.provider),providerProductId:text(policy.providerProductId),amountMinor:Number(policy.amountMinor),currency:text(policy.currency).toUpperCase(),environment:text(policy.environment),units:Number(policy.units),policyVersion:text(policy.policyVersion)});}
function digest(policy){return crypto.createHash("sha256").update(JSON.stringify(policy)).digest("hex");}
function validate(policy){const p=canonical(policy||{});if(!p.packageId||!p.provider||!p.providerProductId||!Number.isSafeInteger(p.amountMinor)||p.amountMinor<=0||!/^[A-Z]{3}$/.test(p.currency)||!p.environment||!Number.isSafeInteger(p.units)||p.units<=0||!p.policyVersion)fail("MOVIE_MENTOR_COMMERCIAL_POLICY_INVALID","Commercial policy entries require immutable package, provider, product, positive amount, ISO currency, environment, positive units and version.");return Object.freeze({...p,policyDigest:digest(p)});}

function createMovieMentorCommercialPolicyRegistry({policies=[],configurationSource=""}={}){
  if(!Array.isArray(policies)||policies.length===0)fail("MOVIE_MENTOR_COMMERCIAL_POLICY_NOT_CONFIGURED","At least one server-owned commercial package policy is required.");
  const source=text(configurationSource);
  if(!source)fail("MOVIE_MENTOR_COMMERCIAL_POLICY_CONFIGURATION_SOURCE_REQUIRED","Commercial policy registry requires an explicit server-owned configuration source before it can own catalogue authority.");
  const byPackage=new Map();
  for(const raw of policies){const policy=validate(raw);if(byPackage.has(policy.packageId))fail("MOVIE_MENTOR_COMMERCIAL_POLICY_DUPLICATE_PACKAGE","Commercial packageId values must be unique.");byPackage.set(policy.packageId,policy);}
  async function resolveCommercialPolicy({packageId,provider=null}={}){const policy=byPackage.get(text(packageId));if(!policy)return null;const requestedProvider=text(provider);if(requestedProvider&&requestedProvider!==policy.provider)return null;return policy;}
  function listCommercialPackages(){return Object.freeze([...byPackage.values()].map(policy=>Object.freeze({packageId:policy.packageId,amountMinor:policy.amountMinor,currency:policy.currency,units:policy.units,policyVersion:policy.policyVersion})));}
  function getCatalogueStatus(){return Object.freeze({version:VERSION,domain:CATALOGUE_DOMAIN,production:true,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,configurationSource:source,processLocalFallback:false});}
  const catalogueAuthority=Object.freeze({listCommercialPackages,getStatus:getCatalogueStatus});
  return Object.freeze({version:VERSION,domain:DOMAIN,resolveCommercialPolicy,listCommercialPackages,configuredPackageIds:Object.freeze([...byPackage.keys()]),catalogueAuthority,getCatalogueStatus});
}

export{VERSION as MOVIE_MENTOR_COMMERCIAL_POLICY_REGISTRY_VERSION,DOMAIN as MOVIE_MENTOR_COMMERCIAL_POLICY_REGISTRY_DOMAIN,CATALOGUE_DOMAIN as MOVIE_MENTOR_COMMERCIAL_PACKAGE_CATALOGUE_AUTHORITY_DOMAIN,createMovieMentorCommercialPolicyRegistry};
export default createMovieMentorCommercialPolicyRegistry;
