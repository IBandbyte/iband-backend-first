import {createMovieMentorCreatorStateAtomicReadiness,CREATOR_STATE_COLLECTION,CREATOR_STATE_OPERATION_COLLECTION} from "./MovieMentorCreatorStateAtomicReadiness.js";
import {createMovieMentorCanonicalAtomicMongoConnection} from "./MovieMentorCreatorStateCanonicalMongoConnection.js";

// Production-shape composition only. No connection, collection creation, index creation,
// server mount or production write occurs here. The caller supplies an already connected
// canonical MongoDB client and database from the same connection.
function error(code,message){const e=new Error(message);e.code=code;return e;}
function createMovieMentorCreatorStateAtomicComposition({client,db}={}){
 if(typeof client?.startSession!=="function"||typeof db?.collection!=="function"||typeof db?.client!=="object"&&typeof db?.client!=="function")throw error("MOVIE_MENTOR_CREATOR_STATE_ATOMIC_COMPOSITION_REQUIRED","Canonical connected Mongo client and database are required.");
 if(db.client!==client)throw error("MOVIE_MENTOR_CREATOR_STATE_ATOMIC_CLIENT_MISMATCH","Creator state and ledger must use the transaction client's database.");
 const states=db.collection(CREATOR_STATE_COLLECTION),operations=db.collection(CREATOR_STATE_OPERATION_COLLECTION);
 const readiness=createMovieMentorCreatorStateAtomicReadiness({client,states,operations});
 return Object.freeze({ready:false,activated:false,atomicCreatorStateReadiness:readiness,collections:Object.freeze({states:CREATOR_STATE_COLLECTION,operations:CREATOR_STATE_OPERATION_COLLECTION})});
}
function createMovieMentorCreatorStateAtomicCompositionFromMongoose(connection){
 const {client,db}=createMovieMentorCanonicalAtomicMongoConnection(connection);
 return createMovieMentorCreatorStateAtomicComposition({client,db});
}
export{createMovieMentorCreatorStateAtomicComposition,createMovieMentorCreatorStateAtomicCompositionFromMongoose};
