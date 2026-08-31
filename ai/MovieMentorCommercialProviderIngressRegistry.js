const VERSION="1.1.0";
const ADAPTER_DOMAIN="iband.movie-mentor.commercial-provider-adapter";

function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function ownedStatus(adapter){if(typeof adapter?.getStatus!=="function")return null;try{const status=adapter.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function ingressCapabilityProven(provider,status){return status?.domain===ADAPTER_DOMAIN&&text(status?.provider)===provider&&status?.productionCommercialProviderAdapter===true&&status?.rawBodyDeliveryVerification===true&&status?.signatureVerification===true&&status?.normalizesCommercialEvidence===true&&status?.creatorPayloadIsNotPaymentAuthority===true&&status?.processLocalFallback===false;}

function createMovieMentorCommercialProviderIngressRegistry({providers={}}={}){
  const entries=new Map();
  for(const [name,adapter] of Object.entries(providers||{})){
    const provider=text(name),status=ownedStatus(adapter);
    if(!provider||!adapter||typeof adapter.verifyDelivery!=="function"||typeof adapter.normalizeEvent!=="function"||!ingressCapabilityProven(provider,status)){
      fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID","Every configured commercial ingress provider must own raw signed-delivery verification and commercial evidence normalization capability.");
    }
    entries.set(provider,Object.freeze({verifyDelivery:adapter.verifyDelivery,normalizeEvent:adapter.normalizeEvent,status}));
  }

  function resolveProvider({provider}={}){
    const key=text(provider);
    const adapter=entries.get(key);
    if(!key||!adapter)fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_NOT_CONFIGURED","Commercial delivery names a provider that is not explicitly configured for ingress.");
    return adapter;
  }

  return Object.freeze({resolveProvider,configuredProviders:Object.freeze([...entries.keys()]),providerStatuses:Object.freeze(Object.fromEntries([...entries].map(([name,entry])=>[name,entry.status])))});
}

export{VERSION as MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_REGISTRY_VERSION,createMovieMentorCommercialProviderIngressRegistry};
export default createMovieMentorCommercialProviderIngressRegistry;
