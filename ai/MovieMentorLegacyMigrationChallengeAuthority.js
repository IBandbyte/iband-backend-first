import crypto from "node:crypto";

const MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_VERSION = "1.3.0";
const CHALLENGE_DOMAIN = "iband.movie-mentor.legacy-ownership-migration-challenge";
const CHALLENGE_SCHEMA = 1;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function s(value) { return typeof value === "string" ? value.trim() : ""; }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }
function parseTime(value) { const ms = Date.parse(value || ""); return Number.isFinite(ms) ? ms : null; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function normalizeIdentity(project) {
  const projectId = s(project?.id || project?.projectId);
  const identity = project?.identity && typeof project.identity === "object" ? project.identity : null;
  const domain = s(identity?.domain), schema = Number.isSafeInteger(identity?.schema) ? identity.schema : null, issuance = s(identity?.issuance);
  if (!projectId || !domain || schema === null || !issuance) fail("MOVIE_MENTOR_LEGACY_MIGRATION_PROJECT_IDENTITY_REQUIRED", "Migration challenge requires immutable Movie Mentor project identity.");
  return Object.freeze({ projectId, identity: Object.freeze({ domain, schema, issuance }) });
}

function inspectChallenge(challenge, { now = Date.now() } = {}) {
  if (!challenge || typeof challenge !== "object" || Array.isArray(challenge)) return Object.freeze({ valid: false, reason: "challenge-not-object" });
  if (challenge.domain !== CHALLENGE_DOMAIN || challenge.schema !== CHALLENGE_SCHEMA) return Object.freeze({ valid: false, reason: "domain-or-schema-invalid" });
  const challengeId=s(challenge.challengeId),principalId=s(challenge.principalId),projectId=s(challenge.projectId),nonce=s(challenge.nonce),issuedAtMs=parseTime(challenge.issuedAt),expiresAtMs=parseTime(challenge.expiresAt),identity=challenge.projectIdentity;
  if(!challengeId||!principalId||!projectId||!nonce||issuedAtMs===null||expiresAtMs===null||expiresAtMs<=issuedAtMs)return Object.freeze({valid:false,reason:"required-field-invalid"});
  if(!identity||!s(identity.domain)||!Number.isSafeInteger(identity.schema)||!s(identity.issuance))return Object.freeze({valid:false,reason:"identity-invalid"});
  if(issuedAtMs>now+30_000)return Object.freeze({valid:false,reason:"issued-in-future"});
  return Object.freeze({valid:true,challengeId,principalId,projectId,nonce,issuedAtMs,expiresAtMs,expired:expiresAtMs<=now,projectIdentity:Object.freeze({domain:s(identity.domain),schema:identity.schema,issuance:s(identity.issuance)})});
}

function assertBinding(candidate,principal,project,{allowConsumed=false,consumptionId=null,now=Date.now()}={}){
  const principalId=s(principal?.principalId); if(!principalId||principal?.authenticated!==true)fail("MOVIE_MENTOR_LEGACY_MIGRATION_AUTHENTICATION_REQUIRED","Migration challenge verification requires a deterministically authenticated principal.");
  const {projectId,identity}=normalizeIdentity(project),inspection=inspectChallenge(candidate,{now});
  if(!inspection.valid)fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_INVALID","Migration challenge is malformed or not trustworthy.",{reason:inspection.reason});
  if(inspection.principalId!==principalId)fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_PRINCIPAL_CONFLICT","Migration challenge belongs to another authenticated principal.");
  if(inspection.projectId!==projectId)fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_PROJECT_CONFLICT","Migration challenge belongs to another project.");
  if(inspection.projectIdentity.domain!==identity.domain||inspection.projectIdentity.schema!==identity.schema||inspection.projectIdentity.issuance!==identity.issuance)fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_IDENTITY_CONFLICT","Migration challenge does not bind the same immutable project identity.");
  if(allowConsumed&&s(candidate.status)==="consumed"&&s(candidate.consumptionId)===s(consumptionId))return inspection;
  return inspection;
}

function createMovieMentorLegacyMigrationChallengeAuthority({now=()=>Date.now(),randomId=()=>crypto.randomUUID(),randomNonce=()=>crypto.randomBytes(32).toString("base64url"),ttlMs=DEFAULT_TTL_MS,persistChallenge=null,readChallenge=null,consumeChallenge=null}={}){
  if(!Number.isSafeInteger(ttlMs)||ttlMs<60_000)fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_TTL_INVALID","Migration challenge TTL must be at least one minute.");
  async function mintChallenge({principal=null,project=null}={}){const principalId=s(principal?.principalId);if(!principalId||principal?.authenticated!==true)fail("MOVIE_MENTOR_LEGACY_MIGRATION_AUTHENTICATION_REQUIRED","Migration challenge requires a deterministically authenticated principal.");const {projectId,identity}=normalizeIdentity(project),issuedAtMs=now();const challenge=Object.freeze({domain:CHALLENGE_DOMAIN,schema:CHALLENGE_SCHEMA,challengeId:`movie-mentor-legacy-migration:${randomId()}`,principalId,projectId,projectIdentity:identity,nonce:randomNonce(),issuedAt:new Date(issuedAtMs).toISOString(),expiresAt:new Date(issuedAtMs+ttlMs).toISOString(),status:"issued"});if(typeof persistChallenge==="function")await persistChallenge(clone(challenge));return challenge;}
  async function load(challenge){let candidate=challenge;const suppliedId=s(challenge?.challengeId);if(typeof readChallenge==="function"&&suppliedId)candidate=await readChallenge({challengeId:suppliedId});return candidate;}
  async function verifyChallengeBinding({challenge=null,principal=null,project=null}={}){const candidate=await load(challenge),clock=now(),inspection=assertBinding(candidate,principal,project,{now:clock});if(inspection.expiresAtMs<=clock)fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_EXPIRED","Migration challenge has expired.");if(s(candidate.status)!=="issued")fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_NOT_ACTIVE","Migration challenge is no longer active.");return Object.freeze({verified:true,challenge:Object.freeze(clone(candidate))});}
  async function consumeForAttestationEligibility({challenge=null,principal=null,project=null,consumptionId=null}={}){
    const id=s(consumptionId);if(!id)fail("MOVIE_MENTOR_LEGACY_MIGRATION_CONSUMPTION_ID_REQUIRED","Challenge consumption requires a one-time consumption identity.");if(typeof consumeChallenge!=="function")fail("MOVIE_MENTOR_LEGACY_MIGRATION_CONSUMER_REQUIRED","Atomic durable challenge consumption is required before attestation eligibility can be granted.");
    const durable=await load(challenge),clock=now(),inspection=assertBinding(durable,principal,project,{allowConsumed:true,consumptionId:id,now:clock});
    if(s(durable?.status)==="consumed"){
      if(s(durable.consumptionId)!==id)fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_CONSUMPTION_CONFLICT","Migration challenge was already consumed by a different operation.");
      return Object.freeze({eligible:true,status:"already-consumed-by-this-operation",challengeId:inspection.challengeId,consumptionId:id,principalId:inspection.principalId,projectId:inspection.projectId,projectIdentity:inspection.projectIdentity,consumedAt:durable.consumedAt||null});
    }
    if(inspection.expiresAtMs<=clock)fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_EXPIRED","Migration challenge has expired.");if(s(durable?.status)!=="issued")fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_NOT_ACTIVE","Migration challenge is no longer active.");
    const consumedAt=new Date(clock).toISOString(),result=await consumeChallenge({challengeId:inspection.challengeId,expectedStatus:"issued",principalId:inspection.principalId,projectId:inspection.projectId,consumptionId:id,consumedAt});
    if(!result||result.consumed!==true){const reality=typeof readChallenge==="function"?await readChallenge({challengeId:inspection.challengeId}):null;if(reality&&s(reality.status)==="consumed"&&s(reality.consumptionId)===id&&s(reality.principalId)===inspection.principalId&&s(reality.projectId)===inspection.projectId)return Object.freeze({eligible:true,status:"already-consumed-by-this-operation",challengeId:inspection.challengeId,consumptionId:id,principalId:inspection.principalId,projectId:inspection.projectId,projectIdentity:inspection.projectIdentity,consumedAt:reality.consumedAt||consumedAt});fail("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_CONSUMPTION_CONFLICT","Migration challenge was not atomically consumed by this operation.");}
    return Object.freeze({eligible:true,status:"consumed",challengeId:inspection.challengeId,consumptionId:id,principalId:inspection.principalId,projectId:inspection.projectId,projectIdentity:inspection.projectIdentity,consumedAt});
  }
  return Object.freeze({mintChallenge,verifyChallengeBinding,consumeForAttestationEligibility});
}
export {MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_VERSION,CHALLENGE_DOMAIN as MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_DOMAIN,CHALLENGE_SCHEMA as MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_SCHEMA,inspectChallenge as inspectMovieMentorLegacyMigrationChallenge,createMovieMentorLegacyMigrationChallengeAuthority};
export default createMovieMentorLegacyMigrationChallengeAuthority;
