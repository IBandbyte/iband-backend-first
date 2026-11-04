// A provenance-only capability: never connects, selects collections, creates indexes,
// opens sessions or writes. Caller must supply the already-connected Mongoose connection.
function canonicalError(){
 const error=new Error("Atomic creator-state composition requires the exact connected Mongoose Mongo client and its own database.");
 error.code="MOVIE_MENTOR_CREATOR_STATE_CANONICAL_MONGO_CONNECTION_REQUIRED";
 return error;
}
function createMovieMentorCanonicalAtomicMongoConnection(connection){
 if(connection?.readyState!==1||typeof connection?.getClient!=="function")throw canonicalError();
 const client=connection.getClient(),db=connection.db;
 if(typeof client?.startSession!=="function"||typeof db?.collection!=="function"||db.client!==client)throw canonicalError();
 return Object.freeze({client,db});
}
export{createMovieMentorCanonicalAtomicMongoConnection};
