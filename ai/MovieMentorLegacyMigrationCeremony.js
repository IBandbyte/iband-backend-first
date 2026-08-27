import crypto from "node:crypto";
import {createMovieMentorLegacyMigrationChallengeAuthority} from "./MovieMentorLegacyMigrationChallengeAuthority.js";
import {persistMovieMentorLegacyMigrationChallenge,readMovieMentorLegacyMigrationChallenge,consumeMovieMentorLegacyMigrationChallenge,readMovieMentorLegacyMigrationConsumption} from "./MovieMentorLegacyMigrationChallengeStore.js";
import {createMovieMentorLegacyMigrationAttestationIssuer} from "./MovieMentorLegacyMigrationAttestationIssuer.js";
import {createMovieMentorLegacyMigrationAttestationIssuance,readMovieMentorLegacyMigrationAttestationIssuanceByConsumptionId} from "./MovieMentorLegacyMigrationAttestationIssuanceStore.js";
import {certifyLegacyProjectOwnershipAdoption} from "./MovieMentorLegacyProjectOwnershipAdoptionBoundary.js";
import {createMovieMentorProjectOwnershipAuthority} from "./MovieMentorProjectOwnershipRegistry.js";

const VERSION="1.0.0";
function s(v){return typeof v==="string"?v.trim():"";}
function fail(code,message){const e=new Error(message);e.code=code;throw e;}

function createMovieMentorLegacyMigrationCeremony({
  now=()=>Date.now(),randomId=()=>crypto.randomUUID(),randomNonce=()=>crypto.randomBytes(32).toString("base64url"),
  persistChallenge=persistMovieMentorLegacyMigrationChallenge,readChallenge=readMovieMentorLegacyMigrationChallenge,consumeChallenge=consumeMovieMentorLegacyMigrationChallenge,readConsumption=readMovieMentorLegacyMigrationConsumption,
  createIssuance=createMovieMentorLegacyMigrationAttestationIssuance,readIssuanceByConsumptionId=readMovieMentorLegacyMigrationAttestationIssuanceByConsumptionId,
  certifyAdoption=certifyLegacyProjectOwnershipAdoption,ownershipAuthority=createMovieMentorProjectOwnershipAuthority(),verifyAdoptionCredential=null,
  expectedIssuer="iband.movie-mentor.legacy-migration-authority",expectedAudience="iband.movie-mentor.legacy-ownership-adoption",
}={}){
  const challengeAuthority=createMovieMentorLegacyMigrationChallengeAuthority({now,randomId,randomNonce,persistChallenge,readChallenge,consumeChallenge});
  const issuer=createMovieMentorLegacyMigrationAttestationIssuer({now,randomId,issuer:expectedIssuer,readConsumption,createIssuance,readIssuanceByConsumptionId});
  async function begin({principal,project}={}){return challengeAuthority.mintChallenge({principal,project});}
  async function complete({principal,project,challenge,consumptionId=null}={}){
    if(typeof verifyAdoptionCredential!=="function")fail("MOVIE_MENTOR_LEGACY_MIGRATION_CEREMONY_VERIFIER_REQUIRED","Migration ceremony requires trusted adoption credential verification.");
    const operationId=s(consumptionId)||`movie-mentor-legacy-consumption:${randomId()}`;
    const eligibility=await challengeAuthority.consumeForAttestationEligibility({challenge,principal,project,consumptionId:operationId});
    const issuance=await issuer.issue({consumptionId:eligibility.consumptionId,principal,project});
    const certified=await certifyAdoption({principal,project,credential:issuance.attestation,verifyAdoptionCredential,expectedIssuer,expectedAudience,now:now()});
    const ownership=await ownershipAuthority.adoptLegacyOwnership({principal,projectId:s(project?.id||project?.projectId),adoptionAttestation:certified});
    return Object.freeze({status:"completed",challengeId:eligibility.challengeId,consumptionId:eligibility.consumptionId,adoptionId:certified.adoptionId,eligibilityStatus:eligibility.status,issuanceStatus:issuance.status,ownershipStatus:ownership.status,ownership:ownership.ownership});
  }
  return Object.freeze({version:VERSION,begin,complete});
}
export {VERSION as MOVIE_MENTOR_LEGACY_MIGRATION_CEREMONY_VERSION,createMovieMentorLegacyMigrationCeremony};
export default createMovieMentorLegacyMigrationCeremony;
