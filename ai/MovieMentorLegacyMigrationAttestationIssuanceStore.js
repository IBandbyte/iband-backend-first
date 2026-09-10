import mongoose from "mongoose";

const VERSION="1.1.0", COLLECTION="movie_mentor_legacy_migration_attestation_issuances";
const PHYSICAL_AUTHORITY_BOUNDARY="before-legacy-attestation-read-or-irreversible-mint";
const REQUIRED_UNIQUE_INDEXES=Object.freeze([
  Object.freeze({key:Object.freeze({consumptionId:1}),unique:true}),
  Object.freeze({key:Object.freeze({adoptionId:1}),unique:true}),
]);
let connectionPromise=null,model=null,physicalReadyPromise=null,physicalReady=false;

function s(v){return typeof v==="string"?v.trim():"";}
function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function fail(code,message,{retryable=false,boundary=null}={}){const e=new Error(message);e.code=code;e.retryable=retryable;if(boundary)e.boundary=boundary;throw e;}
function uri(){return s(process.env.MONGO_URI||process.env.MONGODB_URI||"");}
function exactKey(actual,required){const a=actual&&typeof actual==="object"?actual:{},r=required&&typeof required==="object"?required:{};const ak=Object.keys(a),rk=Object.keys(r);return ak.length===rk.length&&rk.every(k=>a[k]===r[k]);}

function getModel(){
  if(model)return model;
  const schema=new mongoose.Schema({consumptionId:{type:String,required:true,immutable:true,trim:true},adoptionId:{type:String,required:true,immutable:true,trim:true},principalId:{type:String,required:true,immutable:true,trim:true},projectId:{type:String,required:true,immutable:true,trim:true},challengeId:{type:String,required:true,immutable:true,trim:true},attestation:{type:mongoose.Schema.Types.Mixed,required:true,immutable:true},status:{type:String,enum:["issued"],default:"issued",immutable:true}},{collection:COLLECTION,timestamps:true,strict:true,minimize:false});
  schema.index({consumptionId:1},{unique:true});schema.index({adoptionId:1},{unique:true});
  model=mongoose.models.MovieMentorLegacyMigrationAttestationIssuance||mongoose.model("MovieMentorLegacyMigrationAttestationIssuance",schema);return model;
}
async function connect(){const u=uri();if(!u)fail("MOVIE_MENTOR_LEGACY_ATTESTATION_STORE_NOT_CONFIGURED","Attestation issuance store requires Mongo configuration.");if(mongoose.connection.readyState===1)return mongoose.connection;if(!connectionPromise)connectionPromise=mongoose.connect(u,{serverSelectionTimeoutMS:5000,maxPoolSize:10}).catch(e=>{connectionPromise=null;throw e;});return connectionPromise;}
async function physicalUniqueIndexReadiness(){
  if(physicalReady)return true;
  if(!physicalReadyPromise)physicalReadyPromise=(async()=>{
    await connect();
    const indexes=await getModel().collection.indexes();
    const missing=REQUIRED_UNIQUE_INDEXES.filter(required=>!indexes.some(index=>index?.unique===true&&exactKey(index?.key,required.key)));
    if(missing.length)fail("MOVIE_MENTOR_LEGACY_ATTESTATION_PHYSICAL_AUTHORITY_UNAVAILABLE","Legacy migration attestation issuance requires both physical Mongo unique identities before durable authority.",{retryable:true,boundary:PHYSICAL_AUTHORITY_BOUNDARY});
    physicalReady=true;return true;
  })().catch(error=>{physicalReadyPromise=null;throw error;});
  return physicalReadyPromise;
}
function normalize(d){if(!d)return null;const v=d.toObject?d.toObject():d;return{consumptionId:s(v.consumptionId),adoptionId:s(v.adoptionId),principalId:s(v.principalId),projectId:s(v.projectId),challengeId:s(v.challengeId),attestation:clone(v.attestation),status:s(v.status)};}
async function readMovieMentorLegacyMigrationAttestationIssuanceByConsumptionId({consumptionId}={}){await physicalUniqueIndexReadiness();const id=s(consumptionId);if(!id)fail("MOVIE_MENTOR_LEGACY_ATTESTATION_CONSUMPTION_ID_REQUIRED","Issuance read requires consumptionId.");return normalize(await getModel().findOne({consumptionId:id,status:"issued"}).lean().exec());}
async function readMovieMentorLegacyMigrationAttestationIssuanceByAdoptionId({adoptionId}={}){await physicalUniqueIndexReadiness();const id=s(adoptionId);if(!id)fail("MOVIE_MENTOR_LEGACY_ATTESTATION_ADOPTION_ID_REQUIRED","Issuance read requires adoptionId.");return normalize(await getModel().findOne({adoptionId:id,status:"issued"}).lean().exec());}
async function createMovieMentorLegacyMigrationAttestationIssuance(record={}){await physicalUniqueIndexReadiness();const doc={consumptionId:s(record.consumptionId),adoptionId:s(record.adoptionId),principalId:s(record.principalId),projectId:s(record.projectId),challengeId:s(record.challengeId),attestation:clone(record.attestation),status:"issued"};if(!doc.consumptionId||!doc.adoptionId||!doc.principalId||!doc.projectId||!doc.challengeId||!doc.attestation)fail("MOVIE_MENTOR_LEGACY_ATTESTATION_ISSUANCE_INVALID","Issuance record requires complete immutable coordinates.");try{const created=normalize(await getModel().create(doc));return{created:true,record:created};}catch(error){if(error?.code!==11000)throw error;const byConsumption=await readMovieMentorLegacyMigrationAttestationIssuanceByConsumptionId({consumptionId:doc.consumptionId});if(byConsumption)return{created:false,conflict:"consumption-already-issued",record:byConsumption};const byAdoption=await readMovieMentorLegacyMigrationAttestationIssuanceByAdoptionId({adoptionId:doc.adoptionId});if(byAdoption)return{created:false,conflict:"adoption-id-collision",record:byAdoption};fail("MOVIE_MENTOR_LEGACY_ATTESTATION_UNIQUE_CONFLICT","Unique issuance conflict could not be reconciled.");}}
function getMovieMentorLegacyMigrationAttestationIssuanceStoreStatus(){return{version:VERSION,configured:Boolean(uri()),collection:COLLECTION,consumptionUnique:true,adoptionUnique:true,createOnce:true,physicalUniqueIndexReadiness:"required-before-read-or-mint",physicalAuthorityBoundary:PHYSICAL_AUTHORITY_BOUNDARY,physicalReady};}
export{VERSION as MOVIE_MENTOR_LEGACY_MIGRATION_ATTESTATION_ISSUANCE_STORE_VERSION,COLLECTION as MOVIE_MENTOR_LEGACY_MIGRATION_ATTESTATION_ISSUANCE_COLLECTION,getMovieMentorLegacyMigrationAttestationIssuanceStoreStatus,createMovieMentorLegacyMigrationAttestationIssuance,readMovieMentorLegacyMigrationAttestationIssuanceByConsumptionId,readMovieMentorLegacyMigrationAttestationIssuanceByAdoptionId};
export default readMovieMentorLegacyMigrationAttestationIssuanceByConsumptionId;
