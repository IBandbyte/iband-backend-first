import {createMovieMentorCommercialPaymentEvidenceAuthority} from "./MovieMentorCommercialPaymentEvidenceAuthority.js";
import {createMovieMentorCommercialPaymentEvidenceBridge} from "./MovieMentorCommercialPaymentEvidenceBridge.js";
import {createMovieMentorCommercialProviderIngressRegistry} from "./MovieMentorCommercialProviderIngressRegistry.js";

const VERSION="1.2.0";
const DOMAIN="iband.movie-mentor.commercial-provider-ingress-authority";
const REGISTRY_DOMAIN="iband.movie-mentor.commercial-provider-ingress-registry";
const ADAPTER_DOMAIN="iband.movie-mentor.commercial-provider-adapter";
const PURCHASE_INTENT_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";

function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function ownedStatus(authority){if(typeof authority?.getStatus!=="function")return null;try{const status=authority.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}}
function purchaseIntentProven(status){return status?.domain===PURCHASE_INTENT_DOMAIN&&status?.production===true&&status?.durablePurchaseIntent===true&&status?.immutableCommercialTerms===true&&status?.serverOwnedPolicy===true&&status?.processLocalFallback===false;}
function issuanceProven(status){return status?.domain===ISSUANCE_DOMAIN&&status?.production===true&&status?.durableAtomicIssuance===true&&status?.evidenceIdentityUnique===true&&status?.issuanceReceiptDurable===true&&status?.processLocalFallback===false;}
function adapterProven(provider,status){return status?.domain===ADAPTER_DOMAIN&&text(status?.provider)===provider&&status?.productionCommercialProviderAdapter===true&&status?.rawBodyDeliveryVerification===true&&status?.signatureVerification===true&&status?.normalizesCommercialEvidence===true&&status?.creatorPayloadIsNotPaymentAuthority===true&&status?.processLocalFallback===false;}
function registryProven(status){
  if(status?.domain!==REGISTRY_DOMAIN||status?.providerAdapterProvenanceRequired!==true||status?.rawBodyDeliveryVerificationRequired!==true||status?.signatureVerificationRequired!==true||status?.evidenceNormalizationRequired!==true||status?.creatorPayloadIsNotPaymentAuthority!==true||status?.processLocalFallback!==false)return false;
  const providers=Array.isArray(status?.configuredProviders)?status.configuredProviders:[];
  const providerStatuses=status?.providerStatuses&&typeof status.providerStatuses==="object"?status.providerStatuses:null;
  return providers.length>0&&providerStatuses!==null&&providers.every(provider=>adapterProven(provider,providerStatuses[provider]));
}

function createMovieMentorCommercialProviderIngressAuthority({providers={},purchaseIntentAuthority,issuanceAuthority}={}){
  const purchaseIntentStatus=ownedStatus(purchaseIntentAuthority);
  const issuanceStatus=ownedStatus(issuanceAuthority);
  if(typeof purchaseIntentAuthority?.resolvePurchaseIntent!=="function"||!purchaseIntentProven(purchaseIntentStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED","Verified commercial ingress requires production-proven durable purchase-intent authority.");
  if(typeof issuanceAuthority?.issueVerifiedEvidence!=="function"||!issuanceProven(issuanceStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED","Verified commercial ingress requires production-proven durable entitlement issuance authority.");

  const registry=createMovieMentorCommercialProviderIngressRegistry({providers});
  if(registry.configuredProviders.length===0)fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_NOT_CONFIGURED","Verified commercial ingress requires at least one explicit provider adapter.");
  const providerRegistryStatus=ownedStatus(registry);
  if(!registryProven(providerRegistryStatus))fail("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_REGISTRY_CAPABILITY_NOT_PROVEN","Verified commercial ingress requires registry-owned provider-adapter provenance.");

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

  const status=Object.freeze({version:VERSION,domain:DOMAIN,providerNeutral:true,providerRegistryStatus,providerRegistryProvenanceRequired:true,purchaseIntentStatus,issuanceStatus,purchaseIntentProvenanceRequired:true,issuanceProvenanceRequired:true,processLocalFallback:false});
  return Object.freeze({processProviderDelivery,ingest:processProviderDelivery,configuredProviders:registry.configuredProviders,getStatus:()=>status});
}

export{VERSION as MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_AUTHORITY_VERSION,DOMAIN as MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_AUTHORITY_DOMAIN,createMovieMentorCommercialProviderIngressAuthority};
export default createMovieMentorCommercialProviderIngressAuthority;
