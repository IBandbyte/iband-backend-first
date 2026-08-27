import { randomUUID } from "node:crypto";
import { assertMovieMentorJourneyRecoveryEnvelope, fingerprint } from "./MovieMentorJourneyRecoveryEnvelope.js";
import { readMovieMentorJourneyRecovery, writeMovieMentorJourneyRecovery } from "./MovieMentorJourneyRecoveryStore.js";
const VERSION="1.0.0";
function s(v){return typeof v==="string"?v.trim():"";}
function n(v){return Number.isSafeInteger(v)&&v>=0?v:null;}
function clone(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v));}catch{return v;}}
function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}
function assertNoServerAuthorityInjection(input={}){for(const key of ["recoveryRevision","recoveryGeneration","recoveryReference","recoveryFingerprint","capturedAt","updatedAt"]){if(Object.prototype.hasOwnProperty.call(input,key))fail("MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORITY_INJECTION","Client may not supply backend recovery authority fields.",{field:key});}}
async function applyMovieMentorJourneyRecoveryTransition(input={},deps={}){
  assertNoServerAuthorityInjection(input);
  const projectId=s(input.projectId),expected=n(input.expectedRecoveryRevision);
  if(!projectId)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PROJECT_REQUIRED","Journey recovery transition requires projectId.");
  if(expected===null)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_EXPECTED_REVISION_REQUIRED","Journey recovery transition requires exact expectedRecoveryRevision.");
  const envelopeInspection=assertMovieMentorJourneyRecoveryEnvelope(input.envelope,{projectId});
  const read=deps.readRecovery||readMovieMentorJourneyRecovery,write=deps.writeRecovery||writeMovieMentorJourneyRecovery;
  let current=null;try{current=await read({projectId});}catch(error){if(error?.code!=="MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_FOUND")throw error;}
  if(!current){
    if(expected!==0)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_REVISION_CONFLICT","Initial recovery checkpoint requires expectedRecoveryRevision 0.");
  }else{
    if(expected!==current.recoveryRevision)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_REVISION_CONFLICT","Recovery checkpoint changed before this transition.",{currentRecoveryRevision:current.recoveryRevision,expectedRecoveryRevision:expected});
    if(s(current.lineageId)!==envelopeInspection.lineageId)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_LINEAGE_CONFLICT","Recovery checkpoint belongs to a different sovereignty lineage.");
    const cg=n(current.authorityGeneration),cr=n(current.progressionRevision);
    if(envelopeInspection.authorityGeneration<cg||envelopeInspection.progressionRevision<cr)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_ROLLBACK_REJECTED","Older Journey recovery evidence cannot replace a newer checkpoint.");
    if(envelopeInspection.authorityGeneration===cg&&envelopeInspection.progressionRevision===cr){
      if(s(current.envelopeFingerprint)===envelopeInspection.envelopeFingerprint)return{status:"idempotent",...clone(current)};
      fail("MOVIE_MENTOR_JOURNEY_RECOVERY_SPLIT_BRAIN","Same Journey authority coordinates produced conflicting recovery evidence.");
    }
  }
  const recoveryRevision=current?current.recoveryRevision+1:1,recoveryGeneration=current?current.recoveryGeneration+1:1,capturedAt=new Date().toISOString(),recoveryReference=`movie-mentor:journey-recovery:${recoveryGeneration}:${randomUUID()}`;
  const next={projectId,lineageId:envelopeInspection.lineageId,recoveryRevision,recoveryGeneration,recoveryReference,authorityGeneration:envelopeInspection.authorityGeneration,progressionRevision:envelopeInspection.progressionRevision,envelopeFingerprint:envelopeInspection.envelopeFingerprint,envelope:clone(input.envelope),capturedAt};
  next.recoveryFingerprint=fingerprint({projectId:next.projectId,lineageId:next.lineageId,recoveryRevision:next.recoveryRevision,recoveryGeneration:next.recoveryGeneration,recoveryReference:next.recoveryReference,authorityGeneration:next.authorityGeneration,progressionRevision:next.progressionRevision,envelopeFingerprint:next.envelopeFingerprint,envelope:next.envelope,capturedAt:next.capturedAt});
  try{return{status:current?"advanced":"created",...await write(next,{expectedRecoveryRevision:expected})};}catch(error){
    let reread=null;try{reread=await read({projectId});}catch{}
    if(reread&&s(reread.envelopeFingerprint)===envelopeInspection.envelopeFingerprint&&reread.recoveryRevision===recoveryRevision&&reread.recoveryGeneration===recoveryGeneration)return{status:"committed-after-ack-loss",...clone(reread)};
    throw error;
  }
}
export{VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_TRANSITION_VERSION,assertNoServerAuthorityInjection,applyMovieMentorJourneyRecoveryTransition};
export default applyMovieMentorJourneyRecoveryTransition;
