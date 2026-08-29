import mongoose from "mongoose";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.provider-effect-reality";
const SCHEMA = 1;
const COLLECTION = "movie_mentor_provider_effect_reality";
const STATES = Object.freeze(["unknown", "confirmed", "conflict"]);
let connectionPromise = null;
let model = null;

function text(value){return typeof value === "string" ? value.trim() : "";}
function fail(code,message,extras={}){const error=new Error(message);error.code=code;Object.assign(error,extras);throw error;}
function date(value){const parsed=value instanceof Date?new Date(value):new Date(value);return Number.isNaN(parsed.getTime())?null:parsed;}
function iso(value){const parsed=date(value);return parsed?parsed.toISOString():"";}
function plain(value){return value&&typeof value.toObject==="function"?value.toObject():value;}
function mongoUri(){return text(process.env.MONGO_URI||process.env.MONGODB_URI||"");}

function getModel(){
  if(model)return model;
  const evidenceSchema=new mongoose.Schema({externalEffectId:{type:String,required:true,trim:true},provider:{type:String,required:true,trim:true},observedAt:{type:Date,required:true},source:{type:String,required:true,trim:true}},{_id:false,strict:true,minimize:false});
  const schema=new mongoose.Schema({domain:{type:String,required:true,immutable:true},schema:{type:Number,required:true,immutable:true},providerCallId:{type:String,required:true,immutable:true,trim:true},executionId:{type:String,required:true,immutable:true,trim:true},slotId:{type:String,required:true,immutable:true,trim:true},task:{type:String,required:true,immutable:true,trim:true},state:{type:String,enum:STATES,required:true},dispatchUnknownAt:{type:Date,required:true,immutable:true},evidence:{type:[evidenceSchema],default:[]}},{collection:COLLECTION,timestamps:true,strict:true,minimize:false});
  schema.index({providerCallId:1},{unique:true});
  schema.index({executionId:1,slotId:1});
  model=mongoose.models.MovieMentorProviderEffectReality||mongoose.model("MovieMentorProviderEffectReality",schema);
  return model;
}
async function ensureConnection(){const uri=mongoUri();if(!uri)fail("MOVIE_MENTOR_PROVIDER_EFFECT_MONGO_NOT_CONFIGURED","Provider effect reality requires MONGO_URI or MONGODB_URI.");if(mongoose.connection.readyState===1)return mongoose.connection;if(!connectionPromise)connectionPromise=mongoose.connect(uri,{serverSelectionTimeoutMS:5000,maxPoolSize:10}).catch(error=>{connectionPromise=null;fail("MOVIE_MENTOR_PROVIDER_EFFECT_MONGO_UNAVAILABLE",`Provider effect Mongo store unavailable: ${error instanceof Error?error.message:"Mongo connection failed."}`,{retryable:true});});await connectionPromise;return mongoose.connection;}
function normalize(record){if(!record)return null;const value=plain(record);if(value.domain!==DOMAIN||value.schema!==SCHEMA||![value.providerCallId,value.executionId,value.slotId,value.task].every(text)||!STATES.includes(text(value.state))||!iso(value.dispatchUnknownAt))fail("MOVIE_MENTOR_PROVIDER_EFFECT_RECORD_INVALID","Durable provider effect record is malformed.");const evidence=Array.isArray(value.evidence)?value.evidence.map(item=>Object.freeze({externalEffectId:text(item.externalEffectId),provider:text(item.provider),observedAt:iso(item.observedAt),source:text(item.source)})):[];if(evidence.some(item=>!item.externalEffectId||!item.provider||!item.observedAt||!item.source))fail("MOVIE_MENTOR_PROVIDER_EFFECT_RECORD_INVALID","Durable provider effect evidence is malformed.");const ids=new Set(evidence.map(item=>item.externalEffectId));const expected=ids.size===0?"unknown":ids.size===1?"confirmed":"conflict";if(text(value.state)!==expected)fail("MOVIE_MENTOR_PROVIDER_EFFECT_STATE_INVALID","Provider effect state does not match durable evidence reality.");return Object.freeze({providerCallId:text(value.providerCallId),executionId:text(value.executionId),slotId:text(value.slotId),task:text(value.task),state:expected,dispatchUnknownAt:iso(value.dispatchUnknownAt),evidence:Object.freeze(evidence)});}
function createMovieMentorProviderEffectMongoStore({mongoModel=null,connect=ensureConnection}={}){
  const storeModel=()=>mongoModel||getModel();async function ready(){if(!mongoModel)await connect();}
  async function readEffect(providerCallId){await ready();const record=await storeModel().findOne({providerCallId:text(providerCallId)}).lean().exec();return record?normalize(record):null;}
  async function beginUnknown({providerCallId,executionId,slotId,task,dispatchUnknownAt}={}){await ready();const candidate={domain:DOMAIN,schema:SCHEMA,providerCallId:text(providerCallId),executionId:text(executionId),slotId:text(slotId),task:text(task),state:"unknown",dispatchUnknownAt:date(dispatchUnknownAt),evidence:[]};if(![candidate.providerCallId,candidate.executionId,candidate.slotId,candidate.task].every(Boolean)||!candidate.dispatchUnknownAt)fail("MOVIE_MENTOR_PROVIDER_EFFECT_UNKNOWN_INVALID","UNKNOWN transition requires durable provider-call identity and time.");try{return normalize(await storeModel().create(candidate));}catch(error){if(error?.code!==11000)throw error;const existing=await readEffect(candidate.providerCallId);if(existing&&existing.executionId===candidate.executionId&&existing.slotId===candidate.slotId&&existing.task===candidate.task)return existing;fail("MOVIE_MENTOR_PROVIDER_EFFECT_IDENTITY_CONFLICT","Provider-call identity is already bound to a different effect universe.");}}
  async function appendEvidence({providerCallId,externalEffectId,provider,observedAt,source="provider-response"}={}){await ready();const callId=text(providerCallId),effectId=text(externalEffectId),providerName=text(provider),at=date(observedAt),evidenceSource=text(source);if(!callId||!effectId||!providerName||!at||!evidenceSource)fail("MOVIE_MENTOR_PROVIDER_EFFECT_EVIDENCE_INVALID","Provider effect evidence requires call identity, external effect identity, provider and observation time.");const current=await readEffect(callId);if(!current)return null;if(current.evidence.some(item=>item.externalEffectId===effectId))return current;const nextState=current.evidence.length===0?"confirmed":"conflict";const written=await storeModel().findOneAndUpdate({providerCallId:callId,"evidence.externalEffectId":{$ne:effectId}},{$push:{evidence:{externalEffectId:effectId,provider:providerName,observedAt:at,source:evidenceSource}},$set:{state:nextState}},{new:true,runValidators:true}).lean().exec();return written?normalize(written):readEffect(callId);}
  return Object.freeze({readEffect,beginUnknown,appendEvidence});
}
function getMovieMentorProviderEffectMongoStoreStatus(){const configured=Boolean(mongoUri());return Object.freeze({version:VERSION,domain:DOMAIN,schema:SCHEMA,collection:COLLECTION,configured,readiness:configured?"durable-mongo":"fail-closed-no-mongo",effectStates:STATES});}
export{VERSION as MOVIE_MENTOR_PROVIDER_EFFECT_MONGO_STORE_VERSION,DOMAIN as MOVIE_MENTOR_PROVIDER_EFFECT_MONGO_STORE_DOMAIN,createMovieMentorProviderEffectMongoStore,getMovieMentorProviderEffectMongoStoreStatus};
export default createMovieMentorProviderEffectMongoStore;
