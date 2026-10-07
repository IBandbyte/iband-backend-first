const VERSION="1.0.0",DOMAIN="iband.movie-mentor.terminal-disposition-production-authority";
const text=v=>typeof v==="string"?v.trim():"";
function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}
function createMovieMentorTerminalDispositionProductionAuthority({decisionStore=null,settlementAuthority=null}={}){
 if(typeof decisionStore?.recordAuthorizedDecision!=="function"||typeof decisionStore?.resolveAuthorizedDecision!=="function")fail("MOVIE_MENTOR_TERMINAL_DISPOSITION_DECISION_AUTHORITY_REQUIRED","Terminal production authority requires the durable terminal policy decision owner.");
 if(typeof settlementAuthority?.terminallyReleaseAuthorized!=="function")fail("MOVIE_MENTOR_TERMINAL_DISPOSITION_SETTLEMENT_AUTHORITY_REQUIRED","Terminal production authority requires the owner-proven terminal settlement authority.");
 async function applyPolicyAuthorizedTerminalDisposition({decision=null}={}){
  const executionId=text(decision?.executionId),principalId=text(decision?.principalId),decisionId=text(decision?.decisionId),revision=decision?.entitlementRevision;
  if(!decisionId||!principalId||!executionId||text(decision?.decisionKind)!=="policy-approved-terminal-reservation-release"||!Number.isSafeInteger(revision)||revision<1)fail("MOVIE_MENTOR_TERMINAL_DISPOSITION_POLICY_BINDING_REQUIRED","Terminal production disposition requires a complete policy-approved decision bound to exact entitlement revision.");
  const recorded=await decisionStore.recordAuthorizedDecision({decision});
  if(recorded?.authorized!==true)fail("MOVIE_MENTOR_TERMINAL_DISPOSITION_POLICY_RECORD_FAILED","Terminal policy decision was not durably recorded.");
  const durableDecision=await decisionStore.resolveAuthorizedDecision({decisionId,principalId});
  if(!durableDecision||durableDecision.durableAuthority!==true||text(durableDecision.executionId)!==executionId||durableDecision.entitlementRevision!==revision)fail("MOVIE_MENTOR_TERMINAL_DISPOSITION_POLICY_RESOLUTION_FAILED","Terminal policy decision could not be re-resolved with its exact entitlement revision.");
  return settlementAuthority.terminallyReleaseAuthorized({executionId,decision:durableDecision,expectedEntitlementRevision:durableDecision.entitlementRevision});
 }
 return Object.freeze({applyPolicyAuthorizedTerminalDisposition,getStatus:()=>Object.freeze({version:VERSION,domain:DOMAIN,production:true,durableDecisionRecordRequired:true,durableDecisionResolutionRequired:true,exactEntitlementRevisionBound:true,creatorHttpAuthority:false,processLocalFallback:false})});
}
export{VERSION as MOVIE_MENTOR_TERMINAL_DISPOSITION_PRODUCTION_AUTHORITY_VERSION,DOMAIN as MOVIE_MENTOR_TERMINAL_DISPOSITION_PRODUCTION_AUTHORITY_DOMAIN,createMovieMentorTerminalDispositionProductionAuthority};export default createMovieMentorTerminalDispositionProductionAuthority;
