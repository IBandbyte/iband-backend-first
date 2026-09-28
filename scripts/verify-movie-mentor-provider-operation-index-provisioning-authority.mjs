import assert from "node:assert/strict";
import {createMovieMentorProviderOperationMongoStore} from "../ai/MovieMentorProviderOperationMongoStore.js";

const providerCallIndex={name:"providerCallId_1",key:{providerCallId:1},unique:true};
let provisioned=false,createIndexesCalls=0,durableReads=0;

const query={lean(){return this;},async exec(){durableReads+=1;return null;}};
const model={
  async createIndexes(){createIndexesCalls+=1;provisioned=true;return[];},
  collection:{async indexes(){return provisioned?[providerCallIndex]:[];}},
  findOne(){return query;}
};

const store=createMovieMentorProviderOperationMongoStore({
  mongoModel:model,
  executionCollection:false,
  connect:async()=>{}
});

const result=await store.readOperation("provider-call-provisioning-proof").then(
  value=>({ok:true,value}),
  error=>({ok:false,error})
);

assert.equal(createIndexesCalls,1,"provider-operation readiness must explicitly provision schema indexes before judging the physical catalogue");
assert.equal(result.ok,true,"a legitimate provider-operation read must become available after successful physical index provisioning");
assert.equal(durableReads,1,"durable provider-operation read must execute only after provisioning and physical observation");
console.log("PASS provider operation index provisioning authority — production store explicitly provisions its required schema indexes before trusting the physical catalogue.");
