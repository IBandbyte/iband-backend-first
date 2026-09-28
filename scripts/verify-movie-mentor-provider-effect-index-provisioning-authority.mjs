import assert from "node:assert/strict";
import {createMovieMentorProviderEffectMongoStore} from "../ai/MovieMentorProviderEffectMongoStore.js";

const providerCallIndex={name:"providerCallId_1",key:{providerCallId:1},unique:true};
const effectIdentityIndex={name:"evidence_provider_externalEffectId_unique",key:{"evidence.provider":1,"evidence.externalEffectId":1},unique:true,partialFilterExpression:{"evidence.provider":{$type:"string"},"evidence.externalEffectId":{$type:"string"}}};
const executionIndex={name:"executionId_1",key:{executionId:1},unique:true};
let provisioned=false,createIndexesCalls=0,durableReads=0;

const query={lean(){return this;},async exec(){durableReads+=1;return null;}};
const model={
  async createIndexes(){createIndexesCalls+=1;provisioned=true;return[];},
  collection:{async indexes(){return provisioned?[providerCallIndex,effectIdentityIndex]:[providerCallIndex];}},
  findOne(){return query;},
  find(){return{lean(){return this;},async exec(){durableReads+=1;return[];}}}
};
const store=createMovieMentorProviderEffectMongoStore({
  mongoModel:model,
  executionCollection:false,
  connect:async()=>{}
});

const result=await store.readEffect("provider-call-provisioning-proof").then(
  value=>({ok:true,value}),
  error=>({ok:false,error})
);

assert.equal(createIndexesCalls,1,"provider-effect readiness must explicitly provision schema indexes before judging the physical catalogue");
assert.equal(result.ok,true,"a legitimate provider-effect read must become available after successful physical index provisioning");
assert.equal(durableReads,1,"durable provider-effect read must execute only after provisioning and physical observation");
console.log("PASS provider effect index provisioning authority — production store explicitly provisions its required schema indexes before trusting the physical catalogue.");
