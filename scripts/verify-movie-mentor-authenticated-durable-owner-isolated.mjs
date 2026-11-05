import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import mongoose from "mongoose";
import {createMovieMentorProductionAuthenticationComposition} from "../ai/MovieMentorProductionAuthenticationComposition.js";
import {createMovieMentorProjectOwnershipAuthority,MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION,MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN} from "../ai/MovieMentorProjectOwnershipRegistry.js";
import {createMovieMentorCreatorRequestAuthority} from "../ai/MovieMentorCreatorRequestAuthority.js";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\//.test(uri||""),"Only disposable localhost Mongo is permitted");
process.env.MONGO_URI=uri;
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048,publicKeyEncoding:{type:"spki",format:"pem"},privateKeyEncoding:{type:"pkcs8",format:"pem"}});
const issuer="https://isolated-issuer.example",audience="isolated-movie-mentor",party="https://isolated-creator.example";
const authentication=createMovieMentorProductionAuthenticationComposition({env:{MOVIE_MENTOR_CLERK_JWT_KEY:publicKey,MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify([party]),MOVIE_MENTOR_CLERK_ISSUER:issuer,MOVIE_MENTOR_AUDIENCE:audience}});
assert.equal(authentication.ready,true);
const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
const now=Math.floor(Date.now()/1000);
function credential(subject){const body=encode({alg:"RS256",typ:"JWT"})+"."+encode({sub:subject,iss:issuer,aud:audience,azp:party,sid:"session-"+subject,iat:now,nbf:now-1,exp:now+600});return body+"."+sign("RSA-SHA256",Buffer.from(body),privateKey).toString("base64url");}
const alice=credential("creator-alice"),bob=credential("creator-bob"),projectId="isolated-project-alice";
await mongoose.connect(uri,{serverSelectionTimeoutMS:5000,autoIndex:false});
try{
 const collection=mongoose.connection.collection(MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION);
 await collection.createIndex({projectId:1},{unique:true});
 await collection.createIndex({establishmentAuthorityId:1},{unique:true});
 await collection.insertOne({domain:MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN,schema:1,projectId,ownerPrincipalId:"creator-alice",ownershipRevision:1,ownershipReference:"isolated-ownership-alice",establishmentAuthorityId:"isolated-establishment-alice",establishmentSource:"isolated-test",status:"active",establishedAt:new Date()});
 const ownershipAuthority=createMovieMentorProjectOwnershipAuthority();
 assert.equal(ownershipAuthority.getStatus().durable,true);
 const authority=createMovieMentorCreatorRequestAuthority({verifyCredential:authentication.verifyCredential,expectedIssuer:issuer,expectedAudience:audience,ownershipAuthority});
 const request=token=>({headers:{authorization:"Bearer "+token}});
 const granted=await authority.authorize({request:request(alice),projectId});
 assert.equal(granted.authorized,true);
 assert.equal(granted.principalId,"creator-alice");
 assert.equal(granted.ownershipRef,"isolated-ownership-alice");
 await assert.rejects(()=>authority.authorize({request:request(bob),projectId}),{code:"MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED"});
 await assert.rejects(()=>authority.authorize({request:request(alice),projectId:"isolated-project-missing"}),{code:"MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED"});
 await assert.rejects(()=>authority.authorize({request:{headers:{}},projectId}),{code:"MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED"});
 console.log("GREEN: real ephemeral Clerk authentication plus disposable Mongo durable ownership grants Alice only, denies Bob, missing project and absent credential.");
}finally{await mongoose.disconnect();}
