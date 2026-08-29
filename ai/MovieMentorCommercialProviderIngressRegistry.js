const VERSION="1.0.0";

function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}

function createMovieMentorCommercialProviderIngressRegistry({providers={}}={}){
  const entries=new Map();
  for(const [name,adapter] of Object.entries(providers||{})){
    const provider=text(name);
    if(!provider||!adapter||typeof adapter.verifyDelivery!=="function"||typeof adapter.normalizeEvent!=="function"){
      fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID","Every configured commercial ingress provider must expose verifyDelivery() and normalizeEvent().");
    }
    entries.set(provider,Object.freeze({verifyDelivery:adapter.verifyDelivery,normalizeEvent:adapter.normalizeEvent}));
  }

  function resolveProvider({provider}={}){
    const key=text(provider);
    const adapter=entries.get(key);
    if(!key||!adapter)fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_NOT_CONFIGURED","Commercial delivery names a provider that is not explicitly configured for ingress.");
    return adapter;
  }

  return Object.freeze({resolveProvider,configuredProviders:Object.freeze([...entries.keys()])});
}

export{VERSION as MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_REGISTRY_VERSION,createMovieMentorCommercialProviderIngressRegistry};
export default createMovieMentorCommercialProviderIngressRegistry;
