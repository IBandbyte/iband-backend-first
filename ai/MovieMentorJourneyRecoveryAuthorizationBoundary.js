const MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORIZATION_VERSION="1.0.0";
function cleanString(v){return typeof v==="string"?v.trim():"";}
function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}
async function authorizeMovieMentorJourneyRecoveryRequest({principal=null,projectId=null,authorizeProject=null}={}){
  const pid=cleanString(projectId);
  if(!pid)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PROJECT_REQUIRED","Journey recovery authorization requires a projectId.");
  const principalId=cleanString(principal?.principalId||principal?.userId||principal?.id);
  if(!principalId||principal?.authenticated!==true){
    fail("MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_REQUIRED","Journey recovery publication requires a deterministically authenticated principal.");
  }
  if(typeof authorizeProject!=="function"){
    fail("MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORIZATION_RESOLVER_REQUIRED","Journey recovery publication requires a deterministic project authorization resolver.");
  }
  const decision=await authorizeProject({principal:{principalId,authenticated:true},projectId:pid});
  if(!decision||decision.authorized!==true){
    fail("MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED","Authenticated principal is not authorized for this Movie Mentor project.",{principalId,projectId:pid});
  }
  const resolvedProjectId=cleanString(decision.projectId||pid);
  if(resolvedProjectId!==pid){
    fail("MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORIZATION_PROJECT_CONFLICT","Authorization resolver returned a different project identity.");
  }
  return Object.freeze({
    authorized:true,
    principalId,
    projectId:pid,
    ownershipRef:cleanString(decision.ownershipRef)||null,
    authorizationSource:cleanString(decision.authorizationSource)||"deterministic-project-authorization",
  });
}
export{MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORIZATION_VERSION,authorizeMovieMentorJourneyRecoveryRequest};
export default authorizeMovieMentorJourneyRecoveryRequest;
