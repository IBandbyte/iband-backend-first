const VERSION="1.0.0";
const DOMAIN="iband.movie-mentor.policy-decision-ingress-authority";
const DECISION_KIND="policy-approved-terminal-reservation-release";

const text=value=>typeof value==="string"?value.trim():"";

function fail(code,message,extras={}){
 const error=new Error(message);
 error.code=code;
 Object.assign(error,extras);
 throw error;
}

function createMovieMentorPolicyDecisionIngressAuthority({
 authorizePolicyDecision=null,
 terminalDispositionAuthority=null
}={}){
 if(typeof authorizePolicyDecision!=="function"){
  fail("MOVIE_MENTOR_POLICY_DECISION_AUTHORITY_REQUIRED","Policy decision ingress requires a trusted policy authorization boundary.");
 }
 if(typeof terminalDispositionAuthority?.applyPolicyAuthorizedTerminalDisposition!=="function"){
  fail("MOVIE_MENTOR_POLICY_TERMINAL_DISPOSITION_AUTHORITY_REQUIRED","Policy decision ingress requires the certified terminal disposition production authority.");
 }

 async function applyPolicyDecision({request=null}={}){
  const authorization=await authorizePolicyDecision({request});
  if(authorization?.authorized!==true){
   fail("MOVIE_MENTOR_POLICY_DECISION_NOT_AUTHORIZED","Terminal disposition requires explicit policy authorization.");
  }

  const decision=authorization?.decision;
  const normalized=Object.freeze({
   decisionId:text(decision?.decisionId),
   principalId:text(decision?.principalId),
   reservationId:text(decision?.reservationId),
   executionId:text(decision?.executionId),
   decisionSource:text(decision?.decisionSource),
   decisionKind:text(decision?.decisionKind),
   decidedBy:text(decision?.decidedBy),
   policyVersion:text(decision?.policyVersion),
   caseReference:text(decision?.caseReference),
   entitlementRevision:decision?.entitlementRevision,
   decidedAt:text(decision?.decidedAt)
  });

  if(
   !normalized.decisionId||
   !normalized.principalId||
   !normalized.reservationId||
   !normalized.executionId||
   !normalized.decisionSource||
   normalized.decisionKind!==DECISION_KIND||
   !normalized.decidedBy||
   !normalized.policyVersion||
   !normalized.caseReference||
   !Number.isSafeInteger(normalized.entitlementRevision)||
   normalized.entitlementRevision<1||
   !normalized.decidedAt||
   Number.isNaN(Date.parse(normalized.decidedAt))
  ){
   fail("MOVIE_MENTOR_POLICY_DECISION_BINDING_INVALID","Policy authorization must return complete immutable terminal disposition coordinates.");
  }

  return terminalDispositionAuthority.applyPolicyAuthorizedTerminalDisposition({decision:normalized});
 }

 return Object.freeze({
  applyPolicyDecision,
  getStatus:()=>Object.freeze({
   version:VERSION,
   domain:DOMAIN,
   production:true,
   trustedPolicyAuthorizationRequired:true,
   durableDecisionDelegated:true,
   terminalDispositionDelegated:true,
   creatorHttpAuthority:false,
   legacyAdminAuthority:false,
   processLocalFallback:false
  })
 });
}

export {
 VERSION as MOVIE_MENTOR_POLICY_DECISION_INGRESS_AUTHORITY_VERSION,
 DOMAIN as MOVIE_MENTOR_POLICY_DECISION_INGRESS_AUTHORITY_DOMAIN,
 createMovieMentorPolicyDecisionIngressAuthority
};
export default createMovieMentorPolicyDecisionIngressAuthority;
