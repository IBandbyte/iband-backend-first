import mongoose from "mongoose";

// Canonical default Mongoose singleton only. Connection preparation is network-only:
// no schema/model initialization, index creation, transaction or application write.
function configuredMongoUri(env=process.env){
 const value=env.MONGO_URI||env.MONGODB_URI||"";
 return typeof value==="string"?value.trim():"";
}
async function prepareMovieMentorCreatorMongoConnection({env=process.env}={}){
 const connection=mongoose.connection;
 if(connection.readyState===1)return Object.freeze({ready:true,connection});
 const uri=configuredMongoUri(env);
 if(!uri)return Object.freeze({ready:false,reason:"canonical-creator-state-mongo-uri-not-configured"});
 try{
  // The existing store and ownership registry also use the default singleton.
  // Do not initiate a competing connection while it is connecting/disconnecting.
  if(connection.readyState!==0)return Object.freeze({ready:false,reason:"canonical-creator-state-mongo-connection-not-idle"});
  await mongoose.connect(uri,{serverSelectionTimeoutMS:5000,maxPoolSize:10,autoIndex:false});
  if(connection.readyState!==1)return Object.freeze({ready:false,reason:"canonical-creator-state-mongo-connection-not-connected"});
  return Object.freeze({ready:true,connection});
 }catch(error){
  return Object.freeze({ready:false,reason:"canonical-creator-state-mongo-connection-unavailable",code:error?.code||null});
 }
}
export{prepareMovieMentorCreatorMongoConnection};
