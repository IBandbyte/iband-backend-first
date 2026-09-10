const VERSION="1.0.0";
const DOMAIN="iband.movie-mentor.inference-settlement-physical-authority";
const REQUIRED_UNIQUE_INDEXES=Object.freeze([
  Object.freeze({collection:"movie_mentor_inference_execution",key:Object.freeze({executionId:1})}),
  Object.freeze({collection:"movie_mentor_inference_execution",key:Object.freeze({reservationId:1})}),
  Object.freeze({collection:"movie_mentor_canonical_result",key:Object.freeze({executionId:1})}),
  Object.freeze({collection:"movie_mentor_result_candidate",key:Object.freeze({executionId:1})}),
  Object.freeze({collection:"movie_mentor_provider_effect_reality",key:Object.freeze({providerCallId:1})}),
  Object.freeze({collection:"movie_mentor_inference_spend_reservation",key:Object.freeze({reservationId:1})}),
  Object.freeze({collection:"movie_mentor_inference_entitlement",key:Object.freeze({principalId:1})})
]);
function fail(message,cause=null){const error=new Error(message);error.code="MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHYSICAL_AUTHORITY_UNAVAILABLE";error.retryable=true;if(cause)error.cause=cause;throw error;}
function sameKey(actual,expected){const a=actual&&typeof actual==="object"?actual:null;if(!a)return false;const ak=Object.keys(a),ek=Object.keys(expected);return ak.length===ek.length&&ek.every(key=>Number(a[key])===Number(expected[key]));}
function hasRequiredUniqueIndex(indexes,requirement){return Array.isArray(indexes)&&indexes.some(index=>index?.unique===true&&sameKey(index?.key,requirement.key));}
function createMovieMentorInferenceSettlementPhysicalAuthority({store=null,readIndexes=null}={}){
 if(!store||typeof store.settleCanonicalResult!=="function"||typeof store.releaseUnclaimedReservation!=="function"||typeof store.releaseUnboundReservation!=="function")fail("Inference settlement physical authority requires the complete durable settlement store.");
 if(typeof readIndexes!=="function")fail("Inference settlement physical authority requires a physical index reader.");
 let readinessPromise=null;
 async function ensurePhysicalAuthority(){
  if(!readinessPromise){
   readinessPromise=(async()=>{
    const cache=new Map();
    for(const requirement of REQUIRED_UNIQUE_INDEXES){
      let indexes=cache.get(requirement.collection);
      if(!indexes){indexes=await readIndexes(requirement.collection);cache.set(requirement.collection,indexes);}
      if(!hasRequiredUniqueIndex(indexes,requirement))fail(`Required unique index is not physically ready for ${requirement.collection}: ${JSON.stringify(requirement.key)}`);
    }
    return true;
   })().catch(error=>{readinessPromise=null;if(error?.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHYSICAL_AUTHORITY_UNAVAILABLE")throw error;fail(`Inference settlement physical readiness failed: ${error instanceof Error?error.message:"index inspection failed"}`,error);});
  }
  return readinessPromise;
 }
 async function settleCanonicalResult(input){await ensurePhysicalAuthority();return store.settleCanonicalResult(input);}
 async function releaseUnclaimedReservation(input){await ensurePhysicalAuthority();return store.releaseUnclaimedReservation(input);}
 async function releaseUnboundReservation(input){await ensurePhysicalAuthority();return store.releaseUnboundReservation(input);}
 const status=Object.freeze({domain:DOMAIN,version:VERSION,uniquenessReadinessRequired:true,physicalUniqueIndexReadiness:true,readinessBoundary:"before-settlement-or-release-delegation",requiredUniqueIndexes:REQUIRED_UNIQUE_INDEXES,processLocalFallback:false});
 return Object.freeze({settleCanonicalResult,releaseUnclaimedReservation,releaseUnboundReservation,ensurePhysicalAuthority,getStatus:()=>status});
}
export{VERSION as MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHYSICAL_AUTHORITY_VERSION,DOMAIN as MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHYSICAL_AUTHORITY_DOMAIN,REQUIRED_UNIQUE_INDEXES as MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES,createMovieMentorInferenceSettlementPhysicalAuthority};
export default createMovieMentorInferenceSettlementPhysicalAuthority;
