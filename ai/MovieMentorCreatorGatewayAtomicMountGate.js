// Pure fail-closed gate. No router creation, HTTP mounting, Mongo connection,
// transaction or write. Production callers must await this before app.use.
function notReady(){
 const error=new Error("Creator gateway cannot mount without a verified atomic creator-state operation adapter.");
 error.code="MOVIE_MENTOR_CREATOR_GATEWAY_ATOMIC_MOUNT_NOT_READY";
 return error;
}
async function assertMovieMentorCreatorGatewayAtomicMountReadiness({atomicCreatorStateReadiness}={}){
 if(typeof atomicCreatorStateReadiness!=="function")throw notReady();
 let atomicAcceptCreatorStateOperation;
 try{atomicAcceptCreatorStateOperation=await atomicCreatorStateReadiness();}
 catch{throw notReady();}
 if(typeof atomicAcceptCreatorStateOperation!=="function")throw notReady();
 return Object.freeze({atomicAcceptCreatorStateOperation});
}
export{assertMovieMentorCreatorGatewayAtomicMountReadiness};
