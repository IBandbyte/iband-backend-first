import {createMovieMentorCommercialPaymentEvidenceAuthority} from "./MovieMentorCommercialPaymentEvidenceAuthority.js";
import {createMovieMentorCommercialPaymentEvidenceBridge} from "./MovieMentorCommercialPaymentEvidenceBridge.js";
import {createMovieMentorCommercialProviderIngressRegistry} from "./MovieMentorCommercialProviderIngressRegistry.js";

const VERSION="1.1.0";
const DOMAIN="iband.movie-mentor.commercial-provider-ingress-authority";
const PURCHASE_INTENT_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";

function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function ownedStatus(authority){if(typeof authority?.getStatus!=="function")return null;try{const status=authority.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function purchaseIntentProven(status){return status?.domain===PURCHASE_INTENT_DOMAIN&&status?.production===true&&status?.durablePurchaseIntent===true&&status?.immutableCommercialTerms===true&&status?.serverOwnedPolicy===true&&status?.processLocalFallback===false;}
function issuanceProven(status){return status?.domain===ISSUANCE_DOMAIN&&status?.production===true&&status?.durableAtomicIssuance===true&&status?.evidenceIdentityUnique===true&&status?.issuanceReceiptDurable===true&&status?.processLocalFallback===false;}

function createMovieMentorCommercialProviderIngressAuthority({providers={},purchaseIntentAuthority,issuanceAuthority}={}){
  const purchaseIntentStatus=ownedStatus(purchaseIntentAuthority);
  const issuanceStatus=ownedStatus(issuanceAuthority);
  if(typeof purchaseIntentAuthority?.resolvePurchaseIntent!=="function"||!purchaseIntentProven(purchaseIntentStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED","Verified commercial ingress requires production-proven durable purchase-intent authority.");
  if(typeof issuanceAuthority?.issueVerifiedEvidence!=="function"||!issuanceProven(issuanceStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED","Verified commercial ingress requires production-proven durable entitlement issuance authority.");

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
      resolvePurchaseIntent:purchaseIntentAuthority.resolvePurchaseIntent,
    });
    const bridge=createMovieMentorCommercialPaymentEvidenceBridge({evidenceAuthority,issuanceAuthority});
    return bridge.processProviderDelivery({delivery});
  }

  const status=Object.freeze({version:VERSION,domain:DOMAIN,providerNeutral:true,purchaseIntentStatus,issuanceStatus,purchaseIntentProvenanceRequired:true,issuanceProvenanceRequired:true,processLocalFallback:false});
  return Object.freeze({processProviderDelivery,ingest:processProviderDelivery,configuredProviders:registry.configuredProviders,getStatus:()=>status});
}

export{VERSION as MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_AUTHORITY_VERSION,DOMAIN as MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_AUTHORITY_DOMAIN,createMovieMentorCommercialProviderIngressAuthority};
export default createMovieMentorCommercialProviderIngressAuthority;
