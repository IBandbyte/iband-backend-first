import crypto from "node:crypto";

const VERSION = "1.1.0";
const DOMAIN = "iband.movie-mentor.legacy-ownership-adoption-issuance";
const AUDIENCE = "iband.movie-mentor.legacy-ownership-adoption";
function s(v){return typeof v==="string"?v.trim():"";}
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function freezeAttestation(v){return Object.freeze({...v,projectIdentity:Object.freeze({...v.projectIdentity})});}
function result(status,record){return Object.freeze({issued:true,status,attestation:freezeAttestation(record.attestation||record)});}

function createMovieMentorLegacyMigrationAttestationIssuer({now=()=>Date.now(),randomId=()=>crypto.randomUUID(),issuer="iband.movie-mentor.legacy-migration-authority",ttlMs=10*60*1000,maxAdoptionIdAttempts=4,readConsumption=null,createIssuance=null,readIssuanceByConsumptionId=null}={}){
  if(typeof readConsumption!=="function"||typeof createIssuance!=="function"||typeof readIssuanceByConsumptionId!=="function") fail("MOVIE_MENTOR_LEGACY_ATTESTATION_DURABILITY_REQUIRED","Attestation issuance requires durable consumption and issuance authorities.");
  async function issue({consumptionId,principal,project}={}){
    const cid=s(consumptionId),principalId=s(principal?.principalId),projectId=s(project?.id||project?.projectId);
    if(!cid||principal?.authenticated!==true||!principalId||!projectId) fail("MOVIE_MENTOR_LEGACY_ATTESTATION_COORDINATES_REQUIRED","Issuance requires authenticated principal, project, and consumption identity.");
    const consumption=await readConsumption({consumptionId:cid});
    if(!consumption||consumption.status!=="consumed"||s(consumption.consumptionId)!==cid) fail("MOVIE_MENTOR_LEGACY_ATTESTATION_CONSUMPTION_NOT_PROVEN","No exact durable consumed challenge proves issuance eligibility.");
    if(s(consumption.principalId)!==principalId||s(consumption.projectId)!==projectId) fail("MOVIE_MENTOR_LEGACY_ATTESTATION_CONSUMPTION_CONFLICT","Consumed challenge belongs to different coordinates.");
    const identity=consumption.projectIdentity||{},currentIdentity=project?.identity||{};
    if(s(identity.domain)!==s(currentIdentity.domain)||identity.schema!==currentIdentity.schema||s(identity.issuance)!==s(currentIdentity.issuance)) fail("MOVIE_MENTOR_LEGACY_ATTESTATION_IDENTITY_CONFLICT","Consumed challenge identity no longer matches project identity.");
    const existing=await readIssuanceByConsumptionId({consumptionId:cid}); if(existing)return result("already-issued",existing);
    for(let attempt=1;attempt<=maxAdoptionIdAttempts;attempt++){
      const issuedAtMs=Number(now()),adoptionId=`movie-mentor-legacy-adoption:${randomId()}`;
      const attestation=freezeAttestation({verified:true,domain:DOMAIN,schema:1,adoptionId,subject:principalId,principalId,projectId,projectIdentity:{domain:s(identity.domain),schema:identity.schema,issuance:s(identity.issuance)},issuer:s(issuer),audience:AUDIENCE,verificationMethod:"durable-consumption-single-use-v1",consumptionId:cid,challengeId:s(consumption.challengeId),issuedAt:new Date(issuedAtMs).toISOString(),expiresAt:new Date(issuedAtMs+ttlMs).toISOString(),revoked:false});
      try{
        const created=await createIssuance({consumptionId:cid,adoptionId,principalId,projectId,challengeId:s(consumption.challengeId),attestation});
        if(created?.created===true||created?.issued===true)return Object.freeze({issued:true,status:"issued",attestation});
        if(created?.conflict==="consumption-already-issued"&&created.record)return result("issued-after-race",created.record);
        if(created?.conflict==="adoption-id-collision"){
          const reality=await readIssuanceByConsumptionId({consumptionId:cid});
          if(reality)return result("issued-after-race",reality);
          continue; // collision belongs elsewhere; only now may a fresh candidate be minted.
        }
      }catch(error){
        const reality=await readIssuanceByConsumptionId({consumptionId:cid});
        if(reality)return result("issued-after-ack-loss",reality);
        throw error; // ambiguous failure with no durable same-consumption reality: never blind retry.
      }
      const reality=await readIssuanceByConsumptionId({consumptionId:cid}); if(reality)return result("issued-after-race",reality);
      fail("MOVIE_MENTOR_LEGACY_ATTESTATION_ISSUANCE_LOST","Attestation issuance did not establish durable reality.");
    }
    fail("MOVIE_MENTOR_LEGACY_ATTESTATION_ADOPTION_ID_COLLISION_EXHAUSTED","Fresh adoption identity candidates repeatedly collided with unrelated durable issuances.");
  }
  return Object.freeze({version:VERSION,issue});
}
export {VERSION as MOVIE_MENTOR_LEGACY_MIGRATION_ATTESTATION_ISSUER_VERSION,DOMAIN as MOVIE_MENTOR_LEGACY_MIGRATION_ATTESTATION_ISSUANCE_DOMAIN,AUDIENCE as MOVIE_MENTOR_LEGACY_MIGRATION_ATTESTATION_AUDIENCE,createMovieMentorLegacyMigrationAttestationIssuer};
export default createMovieMentorLegacyMigrationAttestationIssuer;
