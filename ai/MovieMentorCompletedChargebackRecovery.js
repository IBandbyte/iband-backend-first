import {isMovieMentorProductionCommercialReversalAuthorityOwnedProof} from "./MovieMentorProductionCommercialReversalComposition.js";
import {isMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedProof} from "./MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {isMovieMentorProductionCommercialCheckoutAuthorityOwnedProof} from "./MovieMentorProductionCommercialCheckoutComposition.js";
import {isMovieMentorProductionCommercialValueDispositionAuthorityOwnedProof,settleMovieMentorRecoveryWithOwner} from "./MovieMentorProductionCommercialValueDispositionComposition.js";
import {acquireRecoveryOwner,releaseRecoveryOwner} from "./MovieMentorCompletedChargebackRecoveryOwnerInternal.js";

const text=value=>typeof value==="string"?value.trim():"";
function fail(message){const error=new Error(message);error.code="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED";throw error;}
async function scanCompletedChargebacks({reversalAuthority,purchaseIntentAuthority,checkoutBindingAuthority,dispositionAuthority,evidenceSource="stripe",pageLimit=50,maxPages=null}={}){
 if(!isMovieMentorProductionCommercialReversalAuthorityOwnedProof(reversalAuthority)||!isMovieMentorProductionCommercialPurchaseIntentAuthorityOwnedProof(purchaseIntentAuthority)||!isMovieMentorProductionCommercialCheckoutAuthorityOwnedProof(checkoutBindingAuthority)||!isMovieMentorProductionCommercialValueDispositionAuthorityOwnedProof(dispositionAuthority))fail("Recovery requires four original owner-proven production authorities.");
 if(evidenceSource!=="stripe"||!Number.isSafeInteger(pageLimit)||pageLimit<1||pageLimit>100||(maxPages!==null&&(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>100)))fail("Recovery scan must be bounded and Stripe-scoped.");
 let cursor=null,scanned=0,settled=0,alreadySettled=0,skipped=0;
 // Ownership is acquired only for a real financial mutation, never for discovery.
 let recoveryCapability=null;
 for(let page=0;maxPages===null||page<maxPages;page++){
  const batch=await reversalAuthority.listCompletedReversalReceipts({evidenceSource,limit:pageLimit,cursor});
  if(!batch||!Array.isArray(batch.receipts)||batch.receipts.length>pageLimit)fail("Completed receipt discovery did not return a valid bounded page.");
  if(batch.receipts.length===0){
   if(batch.nextCursor!==null)fail("Empty completed receipt page cannot claim a continuing cursor.");
   return Object.freeze({complete:true,scanned,settled,alreadySettled,skipped});
  }
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
   if(!recoveryCapability)recoveryCapability=await acquireRecoveryOwner();
   let settlement;
   try{
    settlement=await settleMovieMentorRecoveryWithOwner({authority:dispositionAuthority,capability:recoveryCapability,input:{provider:evidenceSource,providerPaymentReference:payment,commercialIntentId:intentId,principalId:principal,amountMinor:intent.amountMinor,currency,units:intent.units,disposition:"chargeback",chargebackAmountMinor:amount,terminalReference:evidenceId}});
   }catch(error){
    // A failed financial attempt must not monopolise the lease for its full
    // lifetime. Only the original minted generation may relinquish it.
    try{await releaseRecoveryOwner({capability:recoveryCapability});}
    catch(releaseError){process.emitWarning("Recovery lease release failed: "+String(releaseError?.message||releaseError),{code:"MOVIE_MENTOR_RECOVERY_LEASE_RELEASE_FAILED"});}
    throw error;
   }
   const confirmed=await dispositionAuthority.observePreservedValueSettlement(coordinates);
   if(confirmed.settlementState!=="settled")fail("Chargeback settlement was not durably observed.");
   if(settlement?.applied===true)settled++;
   else if(settlement?.applied===false)alreadySettled++;
   else fail("Settlement authority did not provide physical ownership proof.");
  }
  if(batch.nextCursor===null)return Object.freeze({complete:true,scanned,settled,alreadySettled,skipped});
  if(!text(batch.nextCursor)||(cursor!==null&&batch.nextCursor<=cursor))fail("Completed receipt discovery cursor did not advance.");
  cursor=batch.nextCursor;
 }
 fail("Completed receipt scan exceeded bounded page limit; startup must not claim complete recovery.");
}
// A cursor is only a bounded traversal position, never a durable high-water mark.
// Re-enter discovery from null on every pass: a reversal ID can be allocated
// before its Mongo transaction commits, so an earlier ID can become visible
// only after a later ID has already advanced a previous scan.
const activeRecoveryLoops=new WeakMap();
const RESCAN_INTERVAL_MS=750;
function ensureRecoveryLoop(options){
 const owner=options.reversalAuthority;
 if(activeRecoveryLoops.has(owner))return;
 const state={busy:false};
 activeRecoveryLoops.set(owner,state);
 const next=()=>{
  const timer=setTimeout(async()=>{
   if(state.busy){next();return;}
   state.busy=true;
   try{
    await scanCompletedChargebacks(options);
   }catch(error){
    process.emitWarning("Completed chargeback rescan failed: "+String(error?.message||error),{code:"MOVIE_MENTOR_RECOVERY_RESCAN_FAILED"});
   }finally{
    state.busy=false;
    next();
   }
  },RESCAN_INTERVAL_MS);
  timer.unref?.();
 };
 next();
}
async function recoverMovieMentorCompletedChargebacks(options={}){
 // No durable lease validator is integrated yet. Never silently accept a caller-
 // supplied ownership assertion: even a future-dated or correctly shaped proof
 // is untrusted until checked against the authoritative durable lease record.
 if(Object.prototype.hasOwnProperty.call(options,"leaseProof"))fail("Caller-provided recovery lease proof is not an authorised ownership capability.");
 const result=await scanCompletedChargebacks(options);
 if(result.complete===true&&options.maxPages==null)ensureRecoveryLoop(options);
 return result;
}
export {recoverMovieMentorCompletedChargebacks};
