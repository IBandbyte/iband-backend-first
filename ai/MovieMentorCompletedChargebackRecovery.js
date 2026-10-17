import {isMovieMentorProductionCommercialReversalAuthorityOwnedProof} from "./MovieMentorProductionCommercialReversalComposition.js";
import {isMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedProof} from "./MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {isMovieMentorProductionCommercialCheckoutAuthorityOwnedProof} from "./MovieMentorProductionCommercialCheckoutComposition.js";
import {isMovieMentorProductionCommercialValueDispositionAuthorityOwnedProof} from "./MovieMentorProductionCommercialValueDispositionComposition.js";

const text=value=>typeof value==="string"?value.trim():"";
function fail(message){const error=new Error(message);error.code="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED";throw error;}
async function recoverMovieMentorCompletedChargebacks({reversalAuthority,purchaseIntentAuthority,checkoutBindingAuthority,dispositionAuthority,evidenceSource="stripe",pageLimit=50,maxPages=20}={}){
 if(!isMovieMentorProductionCommercialReversalAuthorityOwnedProof(reversalAuthority)||!isMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedProof(purchaseIntentAuthority)||!isMovieMentorProductionCommercialCheckoutAuthorityOwnedProof(checkoutBindingAuthority)||!isMovieMentorProductionCommercialValueDispositionAuthorityOwnedProof(dispositionAuthority))fail("Recovery requires four original owner-proven production authorities.");
 if(evidenceSource!=="stripe"||!Number.isSafeInteger(pageLimit)||pageLimit<1||pageLimit>100||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>100)fail("Recovery scan must be bounded and Stripe-scoped.");
 let cursor=null,scanned=0,settled=0,alreadySettled=0,skipped=0;
 for(let page=0;page<maxPages;page++){
  const batch=await reversalAuthority.listCompletedReversalReceipts({evidenceSource,limit:pageLimit,cursor});
  if(!batch||!Array.isArray(batch.receipts))fail("Completed receipt discovery did not return a valid page.");
  for(const receipt of batch.receipts){
   scanned++;
   if(receipt.evidenceSource!==evidenceSource||receipt.status!=="suspended")fail("Completed receipt provenance is inconsistent.");
   if(receipt.evidenceKind!=="charge.dispute.funds_withdrawn"){skipped++;continue;}
   const payment=text(receipt.providerPaymentReference),intentId=text(receipt.commercialReference),principal=text(receipt.principalId),evidenceId=text(receipt.evidenceId),currency=text(receipt.currency).toUpperCase(),amount=receipt.reversalAmountMinor;
   if(!payment||!intentId||!principal||!evidenceId||!currency||!Number.isSafeInteger(amount)||amount<1)fail("Committed chargeback receipt has incomplete financial provenance.");
   const binding=await checkoutBindingAuthority.resolveCheckoutBindingByProviderPaymentReference({provider:evidenceSource,providerPaymentReference:payment});
   if(!binding||binding.provider!==evidenceSource||binding.providerPaymentReference!==payment||binding.commercialIntentId!==intentId||binding.status!=="completed")fail("Completed chargeback has no exact completed checkout lineage.");
   const intent=await purchaseIntentAuthority.resolvePurchaseIntent({commercialIntentId:intentId});
   if(!intent||intent.commercialIntentId!==intentId||intent.principalId!==principal||intent.provider!==evidenceSource||text(intent.currency).toUpperCase()!==currency||!Number.isSafeInteger(intent.amountMinor)||intent.amountMinor<1||!Number.isSafeInteger(intent.units)||intent.units<1||amount>intent.amountMinor)fail("Completed chargeback conflicts with original purchase intent.");
   const coordinates={provider:evidenceSource,providerPaymentReference:payment,commercialIntentId:intentId,principalId:principal,evidenceId,currency,chargebackAmountMinor:amount};
   const observation=await dispositionAuthority.observePreservedValueSettlement(coordinates);
   if(observation.settlementState==="settled"){alreadySettled++;continue;}
   if(observation.settlementState!=="unsettled")fail("Completed chargeback has no preserved-value ledger row.");
   await dispositionAuthority.terminallySettlePreservedValue({provider:evidenceSource,providerPaymentReference:payment,commercialIntentId:intentId,principalId:principal,amountMinor:intent.amountMinor,currency,units:intent.units,disposition:"chargeback",chargebackAmountMinor:amount,terminalReference:evidenceId});
   const confirmed=await dispositionAuthority.observePreservedValueSettlement(coordinates);
   if(confirmed.settlementState!=="settled")fail("Chargeback settlement was not durably observed.");
   settled++;
  }
  if(batch.nextCursor===null)return Object.freeze({complete:true,scanned,settled,alreadySettled,skipped});
  if(!text(batch.nextCursor)||batch.nextCursor===cursor)fail("Completed receipt discovery cursor did not advance.");
  cursor=batch.nextCursor;
 }
 fail("Completed receipt scan exceeded bounded page limit; startup must not claim complete recovery.");
}
export {recoverMovieMentorCompletedChargebacks};
