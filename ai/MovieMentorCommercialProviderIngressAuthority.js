import {createMovieMentorCommercialPaymentEvidenceAuthority} from "./MovieMentorCommercialPaymentEvidenceAuthority.js";
import {createMovieMentorCommercialPaymentEvidenceBridge} from "./MovieMentorCommercialPaymentEvidenceBridge.js";
import {createMovieMentorCommercialProviderIngressRegistry} from "./MovieMentorCommercialProviderIngressRegistry.js";

const VERSION="1.0.0";
const DOMAIN="iband.movie-mentor.commercial-provider-ingress-authority";

function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}

function createMovieMentorCommercialProviderIngressAuthority({providers={},resolvePurchaseIntent,issuanceAuthority}={}){
  if(typeof resolvePurchaseIntent!=="function")fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED","Verified commercial ingress requires durable purchase-intent resolution.");
  if(typeof issuanceAuthority?.issueVerifiedEvidence!=="function")fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED","Verified commercial ingress requires sealed entitlement issuance authority.");

  const registry=createMovieMentorCommercialProviderIngressRegistry({providers});
  if(registry.configuredProviders.length===0)fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_NOT_CONFIGURED","Verified commercial ingress requires at least one explicit provider adapter.");

  async function processProviderDelivery({provider,delivery=null}={}){
    const selectedProvider=text(provider);
    const adapter=registry.resolveProvider({provider:selectedProvider});
    const evidenceAuthority=createMovieMentorCommercialPaymentEvidenceAuthority({
      verifyDelivery:async({delivery:rawDelivery})=>adapter.verifyDelivery({delivery:rawDelivery}),
      normalizeEvent:async({verifiedDelivery})=>{
        const event=await adapter.normalizeEvent({verifiedDelivery});
        if(text(event?.provider)!==selectedProvider)fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PROVIDER_MISMATCH","Verified provider delivery normalized to a different commercial provider.");
        return event;
      },
      resolvePurchaseIntent,
    });
    const bridge=createMovieMentorCommercialPaymentEvidenceBridge({evidenceAuthority,issuanceAuthority});
    return bridge.processProviderDelivery({delivery});
  }

  return Object.freeze({processProviderDelivery,configuredProviders:registry.configuredProviders});
}

export{VERSION as MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_AUTHORITY_VERSION,DOMAIN as MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_AUTHORITY_DOMAIN,createMovieMentorCommercialProviderIngressAuthority};
export default createMovieMentorCommercialProviderIngressAuthority;
