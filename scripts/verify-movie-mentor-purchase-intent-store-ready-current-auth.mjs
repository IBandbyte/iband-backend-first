import assert from "node:assert/strict";
import {createMovieMentorCommercialPurchaseIntentAuthority} from "../ai/MovieMentorCommercialPurchaseIntentAuthority.js";

let currentTime=new Date("2030-01-01T00:00:00.000Z");
let authReads=0;
let durableWrites=0;

async function currentPrincipalAuthority(){
  authReads++;
  if(currentTime.getTime()>=Date.parse("2030-01-01T00:00:05.000Z")){
    const error=new Error("credential expired during purchase-intent store readiness I/O");
    error.code="MOVIE_MENTOR_AUTH_EXPIRED";
    throw error;
  }
  return Object.freeze({principalId:"creator-store-ready-auth"});
}

const store={
  async create(record,{currentPrincipalAuthority:storeCurrentPrincipalAuthority=null,expectedPrincipalId=null}={}){
    currentTime=new Date("2030-01-01T00:00:06.000Z");
    if(storeCurrentPrincipalAuthority){
      const current=await storeCurrentPrincipalAuthority();
      assert.equal(current?.principalId,expectedPrincipalId);
    }
    durableWrites++;
    return Object.freeze({...record,status:"created"});
  },
  async resolve(){return null;}
};

const authority=createMovieMentorCommercialPurchaseIntentAuthority({
  store,
  resolveCommercialPolicy:async()=>Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"}),
  createCommercialIntentId:()=>"intent-store-ready-auth-1"
});

await assert.rejects(
  ()=>authority.createPurchaseIntent({principalId:"creator-store-ready-auth",packageId:"creator-20",currentPrincipalAuthority}),
  error=>error?.code==="MOVIE_MENTOR_AUTH_EXPIRED"
);
assert.equal(authReads,2,"store-owned irreversible write boundary must re-earn current principal after readiness I/O");
assert.equal(durableWrites,0,"expired authentication after store readiness must prevent durable Mongo create");
console.log("✓ caller pre-write authentication cannot cross store readiness I/O into durable purchase-intent mint");
console.log("✓ the store-owned irreversible write boundary must re-earn current principal immediately before Mongo create");
console.log("LAW: CALLER PRE-WRITE AUTHENTICATION DOES NOT CROSS STORE READINESS I/O; THE DURABLE STORE MUST RE-EARN CURRENT PRINCIPAL AUTHORITY IMMEDIATELY BEFORE MONGO CREATE.");
console.log("purchase-intent store-ready current-auth torture: GREEN");
