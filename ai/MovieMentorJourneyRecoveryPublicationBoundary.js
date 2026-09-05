import { createMovieMentorJourneyRecoveryRequestAuthority } from "./MovieMentorJourneyRecoveryRequestAuthority.js";
import { applyMovieMentorJourneyRecoveryTransition } from "./MovieMentorJourneyRecoveryTransition.js";
import { createMovieMentorJourneyRecoveryPublicationWriteAuthority } from "./MovieMentorJourneyRecoveryPublicationWriteAuthority.js";

const MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_BOUNDARY_VERSION = "1.1.0";
function cleanString(value){return typeof value==="string"?value.trim():"";}
function fail(code,message,extras={}){const error=new Error(message);error.code=code;Object.assign(error,extras);throw error;}
function createMovieMentorJourneyRecoveryPublicationBoundary({requestAuthority=createMovieMentorJourneyRecoveryRequestAuthority(),applyRecoveryTransition=applyMovieMentorJourneyRecoveryTransition,recoveryTransitionDeps=undefined,createPublicationWriteAuthority=createMovieMentorJourneyRecoveryPublicationWriteAuthority}={}){
 if(typeof requestAuthority?.authorize!=="function")fail("MOVIE_MENTOR_JOURNEY_RECOVERY_REQUEST_AUTHORITY_REQUIRED","Journey recovery publication requires the certified request authority.");
 if(typeof applyRecoveryTransition!=="function")fail("MOVIE_MENTOR_JOURNEY_RECOVERY_TRANSITION_REQUIRED","Journey recovery publication requires the recovery transition boundary.");
 if(typeof createPublicationWriteAuthority!=="function")fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_WRITE_AUTHORITY_REQUIRED","Journey recovery publication requires the current-ownership durable-write authority factory.");
 async function publish({request=null,projectId=null,expectedRecoveryRevision=null,envelope=null}={}){
  const pid=cleanString(projectId);if(!pid)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PROJECT_REQUIRED","Journey recovery publication requires an explicit server-selected projectId.");
  const authorization=await requestAuthority.authorize({request,projectId:pid});
  if(authorization?.authorized!==true||cleanString(authorization.projectId)!==pid||!cleanString(authorization.principalId)||!cleanString(authorization.ownershipRef))fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_AUTHORIZATION_INVALID","Journey recovery publication received invalid authorization evidence.");
  const publicationWriteAuthority=createPublicationWriteAuthority({request,authorization,requestAuthority});
  const deps={...(recoveryTransitionDeps||{}),publicationWriteAuthority};
  const recovery=await applyRecoveryTransition({projectId:pid,expectedRecoveryRevision,envelope},deps);
  if(cleanString(recovery?.projectId)!==pid)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_PROJECT_CONFLICT","Journey recovery transition returned a conflicting project identity.");
  return Object.freeze({status:"published",projectId:pid,principalId:authorization.principalId,ownershipRef:authorization.ownershipRef,authenticationSource:authorization.authenticationSource,authorizationSource:authorization.authorizationSource,recoveryStatus:recovery.status,recoveryRevision:recovery.recoveryRevision,recoveryGeneration:recovery.recoveryGeneration,recoveryReference:recovery.recoveryReference,recoveryFingerprint:recovery.recoveryFingerprint,lineageId:recovery.lineageId,authorityGeneration:recovery.authorityGeneration,progressionRevision:recovery.progressionRevision,envelopeFingerprint:recovery.envelopeFingerprint,capturedAt:recovery.capturedAt});
 }
 return Object.freeze({version:MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_BOUNDARY_VERSION,publish});
}
export{MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_BOUNDARY_VERSION,createMovieMentorJourneyRecoveryPublicationBoundary};
export default createMovieMentorJourneyRecoveryPublicationBoundary;
