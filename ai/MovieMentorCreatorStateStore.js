import mongoose from "mongoose";

const MOVIE_MENTOR_CREATOR_STATE_STORE_VERSION="1.0.0";
const COLLECTION_NAME="movie_mentor_creator_state";
let connectionPromise=null;
let model=null;

function s(v){return typeof v==="string"?v.trim():"";}
function n(v){return Number.isSafeInteger(v)&&v>=0?v:null;}
function clone(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v));}catch{return v;}}
function mongoUri(){return s(process.env.MONGO_URI||process.env.MONGODB_URI||"");}

function storeError(code,message,{retryable=false}={}){const error=new Error(message);error.code=code;error.retryable=retryable;return error;}

function getMovieMentorCreatorStateStoreStatus(){const configured=Boolean(mongoUri());return{version:MOVIE_MENTOR_CREATOR_STATE_STORE_VERSION,configured,readiness:configured?"configured":"configuration-required",collection:COLLECTION_NAME,configurationIssues:configured?[]:["missing_mongo_uri"],authority:"durable-server-side-creator-state"};}

function getModel(){
 if(model)return model;
 const schema=new mongoose.Schema({
  projectId:{type:String,trim:true,index:true},
  creatorSessionId:{type:String,trim:true,index:true},
  revision:{type:Number,min:0,required:true},
  revisionAuthorityReference:{type:String,trim:true,required:true},
  creatorStateGeneration:{type:Number,min:0,required:true},
  creatorStateFingerprint:{type:String,trim:true,required:true},
  creatorAuthorityReference:{type:String,trim:true,required:true},
  snapshotReference:{type:String,trim:true,required:true},
  creatorConfirmedContext:{type:[mongoose.Schema.Types.Mixed],default:[]},
  projectJourney:{type:mongoose.Schema.Types.Mixed,default:null},
  memoryContext:{type:mongoose.Schema.Types.Mixed,default:null},
  responseBlueprint:{type:mongoose.Schema.Types.Mixed,default:null},
  communicationPlan:{type:mongoose.Schema.Types.Mixed,default:null},
  capturedAt:{type:Date,required:true},
 },{collection:COLLECTION_NAME,timestamps:true,minimize:false,strict:true});
 schema.index({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 model=mongoose.models.MovieMentorCreatorState||mongoose.model("MovieMentorCreatorState",schema);
 return model;
}

async function ensureConnection(){
 const uri=mongoUri();
 if(!uri)throw storeError("MOVIE_MENTOR_CREATOR_STATE_STORE_NOT_CONFIGURED","Movie Mentor durable creator state store requires MONGO_URI or MONGODB_URI.");
 if(mongoose.connection.readyState===1)return mongoose.connection;
 if(!connectionPromise){connectionPromise=mongoose.connect(uri,{serverSelectionTimeoutMS:5000,maxPoolSize:10}).catch(error=>{connectionPromise=null;throw storeError("MOVIE_MENTOR_CREATOR_STATE_STORE_UNAVAILABLE",`Movie Mentor durable creator state store is unavailable: ${error instanceof Error?error.message:"Mongo connection failed."}`,{retryable:true});});}
 await connectionPromise;
 return mongoose.connection;
}

function identityQuery({projectId,creatorSessionId}={}){
 const project=s(projectId),session=s(creatorSessionId);
 if(!project&&!session)throw storeError("MOVIE_MENTOR_CREATOR_STATE_IDENTITY_REQUIRED","projectId or creatorSessionId is required to read durable Movie Mentor creator state.");
 if(project&&session)return{projectId:project,creatorSessionId:session};
 return project?{projectId:project}:{creatorSessionId:session};
}

function normalizeDocument(doc){
 if(!doc)return null;
 const revision=n(doc.revision),generation=n(doc.creatorStateGeneration);
 if(revision===null||generation===null||!s(doc.revisionAuthorityReference)||!s(doc.creatorStateFingerprint)||!s(doc.creatorAuthorityReference)||!s(doc.snapshotReference)||!doc.capturedAt)throw storeError("MOVIE_MENTOR_CREATOR_STATE_INVALID","Durable Movie Mentor creator state is missing required authority fields.");
 return{projectId:s(doc.projectId)||null,creatorSessionId:s(doc.creatorSessionId)||null,revision,revisionAuthorityReference:s(doc.revisionAuthorityReference),creatorStateGeneration:generation,creatorStateFingerprint:s(doc.creatorStateFingerprint),creatorAuthorityReference:s(doc.creatorAuthorityReference),snapshotReference:s(doc.snapshotReference),creatorConfirmedContext:clone(Array.isArray(doc.creatorConfirmedContext)?doc.creatorConfirmedContext:[]),projectJourney:clone(doc.projectJourney??null),memoryContext:clone(doc.memoryContext??null),responseBlueprint:clone(doc.responseBlueprint??null),communicationPlan:clone(doc.communicationPlan??null),capturedAt:new Date(doc.capturedAt).toISOString(),updatedAt:doc.updatedAt?new Date(doc.updatedAt).toISOString():null};
}

async function readAuthoritativeTurnSource(identity={}){
 await ensureConnection();
 const doc=await getModel().findOne(identityQuery(identity)).lean().exec();
 if(!doc)throw storeError("MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND","No durable authoritative Movie Mentor creator state exists for this project/session.");
 return normalizeDocument(doc);
}

async function readAuthoritativeRevision(identity={}){const state=await readAuthoritativeTurnSource(identity);return{revision:state.revision,reference:state.revisionAuthorityReference,snapshotReference:state.snapshotReference,updatedAt:state.updatedAt};}
async function readAuthoritativeCreatorState(identity={}){const state=await readAuthoritativeTurnSource(identity);return{generation:state.creatorStateGeneration,fingerprint:state.creatorStateFingerprint,authorityReference:state.creatorAuthorityReference,snapshotReference:state.snapshotReference,updatedAt:state.updatedAt};}

export{MOVIE_MENTOR_CREATOR_STATE_STORE_VERSION,COLLECTION_NAME,getMovieMentorCreatorStateStoreStatus,readAuthoritativeTurnSource,readAuthoritativeRevision,readAuthoritativeCreatorState};
export default readAuthoritativeTurnSource;
