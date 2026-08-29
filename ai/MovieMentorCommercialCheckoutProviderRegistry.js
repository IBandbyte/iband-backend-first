const VERSION="1.0.0";
function text(v){return typeof v==="string"?v.trim():"";}
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function createMovieMentorCommercialCheckoutProviderRegistry({providers={}}={}){const entries=new Map();for(const [name,adapter] of Object.entries(providers||{})){const key=text(name);if(!key||!adapter||typeof adapter.createCheckout!=="function")fail("MOVIE_MENTOR_CHECKOUT_PROVIDER_INVALID","Every configured checkout provider must expose createCheckout().");entries.set(key,adapter);}
 async function createProviderCheckout({intent}={}){const provider=text(intent?.provider),adapter=entries.get(provider);if(!provider||!adapter)fail("MOVIE_MENTOR_CHECKOUT_PROVIDER_NOT_CONFIGURED","Purchase intent names a checkout provider that is not explicitly configured.");const result=await adapter.createCheckout({intent:Object.freeze({...intent})});return result;}
 return Object.freeze({createProviderCheckout,configuredProviders:Object.freeze([...entries.keys()])});}
export{VERSION as MOVIE_MENTOR_COMMERCIAL_CHECKOUT_PROVIDER_REGISTRY_VERSION,createMovieMentorCommercialCheckoutProviderRegistry};export default createMovieMentorCommercialCheckoutProviderRegistry;
