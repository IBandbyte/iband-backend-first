const VERSION="1.0.0";
const DOMAIN="iband.movie-mentor.journey-recovery-publication-write-authority";
const PROOF_DOMAIN="iband.movie-mentor.journey-recovery-publication-write-proof";
const OWNED=new WeakSet();
function s(v){return typeof v==="string"?v.trim():"";}
function fail(code,message,extras={}){const e=new Error(message);e.code=code;e.retryable=false;Object.assign(e,extras);throw e;}
function createMovieMentorJourneyRecoveryPublicationWriteAuthority({request=null,authorization=null,requestAuthority=null}={}){
 if(typeof requestAuthority?.authorize!=="function")fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_WRITE_AUTHORITY_REQUIRED","Journey recovery durable publication requires current request authority.");
 const principalId=s(authorization?.principalId),projectId=s(authorization?.projectId),ownershipRef=s(authorization?.ownershipRef);
 if(authorization?.authorized!==true||!principalId||!projectId||!ownershipRef)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_WRITE_AUTHORITY_REQUIRED","Journey recovery durable publication requires authenticated project ownership at admission.");
 const authority=Object.freeze({version:VERSION,domain:DOMAIN,principalId,projectId,ownershipRef,async assertCurrentWrite({projectId:targetProjectId=null}={}){
   if(s(targetProjectId)!==projectId)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_WRITE_BINDING_INVALID","Journey recovery publication write authority is bound to a different project.");
   const current=await requestAuthority.authorize({request,projectId});
   if(current?.authorized!==true||s(current.principalId)!==principalId||s(current.projectId)!==projectId||s(current.ownershipRef)!==ownershipRef)fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_CURRENT_OWNERSHIP_REQUIRED","Journey recovery durable publication requires fresh ownership of the exact creator/project universe at the irreversible store boundary.",{projectId,principalId});
   return Object.freeze({version:VERSION,domain:PROOF_DOMAIN,authorized:true,currentOwnershipVerified:true,principalId,projectId,ownershipRef});
 }});
 OWNED.add(authority);return authority;
}
async function assertMovieMentorJourneyRecoveryPublicationWriteAuthority({authority=null,projectId=null}={}){
 const pid=s(projectId);
 if(!pid||!authority||OWNED.has(authority)!==true||authority.domain!==DOMAIN||s(authority.projectId)!==pid||typeof authority.assertCurrentWrite!=="function")fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_WRITE_AUTHORITY_REQUIRED","Irreversible Journey recovery store mutation requires the server-created current-ownership publication capability.");
 const proof=await authority.assertCurrentWrite({projectId:pid});
 if(proof?.domain!==PROOF_DOMAIN||proof?.authorized!==true||proof?.currentOwnershipVerified!==true||s(proof.principalId)!==s(authority.principalId)||s(proof.projectId)!==pid||s(proof.ownershipRef)!==s(authority.ownershipRef))fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_WRITE_PROOF_INVALID","Journey recovery publication write capability did not prove the exact current ownership universe being mutated.");
 return proof;
}
export{VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_WRITE_AUTHORITY_VERSION,DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_WRITE_AUTHORITY_DOMAIN,PROOF_DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_WRITE_PROOF_DOMAIN,createMovieMentorJourneyRecoveryPublicationWriteAuthority,assertMovieMentorJourneyRecoveryPublicationWriteAuthority};
export default createMovieMentorJourneyRecoveryPublicationWriteAuthority;
