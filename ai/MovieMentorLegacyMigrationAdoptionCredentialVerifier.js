import {readMovieMentorLegacyMigrationAttestationIssuanceByAdoptionId} from "./MovieMentorLegacyMigrationAttestationIssuanceStore.js";

const VERSION="1.0.0";
const DOMAIN="iband.movie-mentor.legacy-ownership-adoption-issuance";
const AUDIENCE="iband.movie-mentor.legacy-ownership-adoption";
function s(v){return typeof v==="string"?v.trim():"";}
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function identity(v){return v&&typeof v==="object"?{domain:s(v.domain),schema:Number.isSafeInteger(v.schema)?v.schema:null,issuance:s(v.issuance)}:null;}
function sameIdentity(a,b){return a&&b&&a.domain&&a.domain===b.domain&&a.schema!==null&&a.schema===b.schema&&a.issuance&&a.issuance===b.issuance;}

function createMovieMentorLegacyMigrationAdoptionCredentialVerifier({readIssuanceByAdoptionId=readMovieMentorLegacyMigrationAttestationIssuanceByAdoptionId,expectedIssuer="iband.movie-mentor.legacy-migration-authority",expectedAudience=AUDIENCE}={}){
  if(typeof readIssuanceByAdoptionId!=="function")fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_STORE_REQUIRED","Durable adoption credential verification requires an issuance lookup authority.");
  return async function verifyAdoptionCredential({credential=null,principal=null,project=null}={}){
    // The credential is deliberately opaque. Client-shaped attestation fields are never trusted.
    const adoptionId=s(typeof credential==="string"?credential:credential?.adoptionId);
    if(!adoptionId)fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_REFERENCE_REQUIRED","Adoption credential must contain an opaque adoption reference.");
    const durable=await readIssuanceByAdoptionId({adoptionId});
    if(!durable||s(durable.status)!=="issued")fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_NOT_FOUND","No durable issued adoption credential exists for this reference.");
    const a=durable.attestation;
    if(!a||typeof a!=="object")fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_DURABLE_INVALID","Durable issuance is missing its attestation evidence.");
    const principalId=s(principal?.principalId),projectId=s(project?.id||project?.projectId),projectIdentity=identity(project?.identity),attestationIdentity=identity(a.projectIdentity);
    const topPrincipal=s(durable.principalId),topProject=s(durable.projectId),topAdoption=s(durable.adoptionId),topChallenge=s(durable.challengeId);
    if(principal?.authenticated!==true||!principalId||!projectId||!projectIdentity?.domain||projectIdentity.schema===null||!projectIdentity.issuance)fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_COORDINATES_REQUIRED","Durable credential verification requires authenticated principal and immutable project identity.");
    if(topAdoption!==adoptionId||s(a.adoptionId)!==adoptionId)fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_ADOPTION_CONFLICT","Durable adoption coordinates disagree.");
    if(topPrincipal!==principalId||s(a.principalId||a.subject)!==principalId||s(a.subject||a.principalId)!==principalId)fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_PRINCIPAL_CONFLICT","Durable adoption credential belongs to another principal.");
    if(topProject!==projectId||s(a.projectId)!==projectId)fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_PROJECT_CONFLICT","Durable adoption credential belongs to another project.");
    if(!sameIdentity(projectIdentity,attestationIdentity))fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_IDENTITY_CONFLICT","Durable adoption credential binds another immutable project identity.");
    if(!s(durable.consumptionId)||s(a.consumptionId)!==s(durable.consumptionId)||!topChallenge||s(a.challengeId)!==topChallenge)fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_LINEAGE_CONFLICT","Durable adoption credential lineage coordinates disagree.");
    if(s(a.domain)!==DOMAIN||a.schema!==1||!s(a.issuer)||s(a.issuer)!==s(expectedIssuer)||s(a.audience)!==s(expectedAudience)||!s(a.verificationMethod)||a.revoked===true)fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_TRUST_INVALID","Durable adoption credential trust metadata is invalid.");
    if(!Number.isFinite(Date.parse(a.issuedAt||""))||!Number.isFinite(Date.parse(a.expiresAt||"")))fail("MOVIE_MENTOR_LEGACY_ADOPTION_CREDENTIAL_TIME_INVALID","Durable adoption credential time metadata is invalid.");
    return Object.freeze({verified:true,domain:s(a.domain),schema:a.schema,adoptionId,subject:principalId,principalId,projectId,projectIdentity:Object.freeze(attestationIdentity),issuer:s(a.issuer),audience:s(a.audience),verificationMethod:s(a.verificationMethod),consumptionId:s(a.consumptionId),challengeId:s(a.challengeId),issuedAt:a.issuedAt,expiresAt:a.expiresAt,revoked:false});
  };
}
export{VERSION as MOVIE_MENTOR_LEGACY_MIGRATION_ADOPTION_CREDENTIAL_VERIFIER_VERSION,createMovieMentorLegacyMigrationAdoptionCredentialVerifier};
export default createMovieMentorLegacyMigrationAdoptionCredentialVerifier;
