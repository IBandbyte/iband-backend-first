const VERSION="1.0.0";
const DOMAIN="iband.movie-mentor.inference-execution-physical-authority";
const REQUIRED_UNIQUE_INDEXES=Object.freeze([
  Object.freeze({collection:"movie_mentor_inference_execution",key:Object.freeze({executionId:1})}),
  Object.freeze({collection:"movie_mentor_inference_execution",key:Object.freeze({principalId:1,projectId:1,creatorTurnId:1})}),
  Object.freeze({collection:"movie_mentor_inference_execution",key:Object.freeze({reservationId:1})}),
  Object.freeze({collection:"movie_mentor_inference_spend_reservation",key:Object.freeze({reservationId:1})})
]);
function fail(message,cause=null){const error=new Error(message);error.code="MOVIE_MENTOR_INFERENCE_EXECUTION_PHYSICAL_AUTHORITY_UNAVAILABLE";error.retryable=true;if(cause)error.cause=cause;throw error;}
function sameKey(actual,expected){if(!actual||typeof actual!=="object")return false;const actualKeys=Object.keys(actual),expectedKeys=Object.keys(expected);return actualKeys.length===expectedKeys.length&&expectedKeys.every(key=>Number(actual[key])===Number(expected[key]));}
function hasRequiredUniqueIndex(indexes,requirement){return Array.isArray(indexes)&&indexes.some(index=>index?.unique===true&&sameKey(index?.key,requirement.key));}
function createMovieMentorInferenceExecutionPhysicalAuthority({store=null,readIndexes=null}={}){
  const requiredMethods=["readExecution","readExecutionByCreatorTurn","createExecution","replaceExecution","claimProviderCall","beginClosing","recoverExpiredIntoClosing","completeClosing","quarantineExecution"];
  if(!store||requiredMethods.some(method=>typeof store?.[method]!=="function"))fail("Inference execution physical authority requires the complete durable execution store.");
  if(typeof readIndexes!=="function")fail("Inference execution physical authority requires a physical index reader.");
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
      })().catch(error=>{readinessPromise=null;if(error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_PHYSICAL_AUTHORITY_UNAVAILABLE")throw error;fail(`Inference execution physical readiness failed: ${error instanceof Error?error.message:"index inspection failed"}`,error);});
    }
    return readinessPromise;
  }
  async function readExecution(...args){await ensurePhysicalAuthority();return store.readExecution(...args);}
  async function readExecutionByCreatorTurn(...args){await ensurePhysicalAuthority();return store.readExecutionByCreatorTurn(...args);}
  async function createExecution(...args){await ensurePhysicalAuthority();return store.createExecution(...args);}
  async function replaceExecution(...args){await ensurePhysicalAuthority();return store.replaceExecution(...args);}
  async function claimProviderCall(...args){await ensurePhysicalAuthority();return store.claimProviderCall(...args);}
  async function beginClosing(...args){await ensurePhysicalAuthority();return store.beginClosing(...args);}
  async function recoverExpiredIntoClosing(...args){await ensurePhysicalAuthority();return store.recoverExpiredIntoClosing(...args);}
  async function completeClosing(...args){await ensurePhysicalAuthority();return store.completeClosing(...args);}
  async function quarantineExecution(...args){await ensurePhysicalAuthority();return store.quarantineExecution(...args);}
  const status=Object.freeze({domain:DOMAIN,version:VERSION,uniquenessReadinessRequired:true,physicalUniqueIndexReadiness:true,readinessBoundary:"before-execution-read-or-mutation-delegation",requiredUniqueIndexes:REQUIRED_UNIQUE_INDEXES,processLocalFallback:false});
  return Object.freeze({readExecution,readExecutionByCreatorTurn,createExecution,replaceExecution,claimProviderCall,beginClosing,recoverExpiredIntoClosing,completeClosing,quarantineExecution,ensurePhysicalAuthority,getStatus:()=>status});
}
export{VERSION as MOVIE_MENTOR_INFERENCE_EXECUTION_PHYSICAL_AUTHORITY_VERSION,DOMAIN as MOVIE_MENTOR_INFERENCE_EXECUTION_PHYSICAL_AUTHORITY_DOMAIN,REQUIRED_UNIQUE_INDEXES as MOVIE_MENTOR_INFERENCE_EXECUTION_REQUIRED_UNIQUE_INDEXES,createMovieMentorInferenceExecutionPhysicalAuthority};
export default createMovieMentorInferenceExecutionPhysicalAuthority;
