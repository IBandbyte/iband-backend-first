import fs from "node:fs";

const canonicalPath="ai/MovieMentorCanonicalResultMongoStore.js";
const candidatePath="ai/MovieMentorResultCandidateMongoStore.js";

let canonical=fs.readFileSync(canonicalPath,"utf8");
const oldIso='const text=v=>typeof v==="string"?v.trim():"";const plain=v=>v&&typeof v.toObject==="function"?v.toObject():v;const iso=v=>{const d=v instanceof Date?new Date(v):new Date(v);return Number.isNaN(d.getTime())?"":d.toISOString();};';
const newIso='const text=v=>typeof v==="string"?v.trim():"";const plain=v=>v&&typeof v.toObject==="function"?v.toObject():v;const iso=v=>{if(v===null||v===undefined||v==="")return "";const d=v instanceof Date?new Date(v):new Date(v);return Number.isNaN(d.getTime())?"":d.toISOString();};';
if(!canonical.includes(oldIso))throw new Error("canonical iso anchor missing");
canonical=canonical.replace(oldIso,newIso);
fs.writeFileSync(canonicalPath,canonical);

let candidate=fs.readFileSync(candidatePath,"utf8");
const oldHead='const VERSION="1.1.0",DOMAIN="iband.movie-mentor.result-candidate-store",SCHEMA=1,COLLECTION="movie_mentor_result_candidate",EXECUTION_COLLECTION="movie_mentor_inference_execution";let connectionPromise=null,model=null;const text=v=>typeof v==="string"?v.trim():"";const plain=v=>v&&typeof v.toObject==="function"?v.toObject():v;';
const newHead='const VERSION="1.2.0",DOMAIN="iband.movie-mentor.result-candidate-store",SCHEMA=1,COLLECTION="movie_mentor_result_candidate",EXECUTION_COLLECTION="movie_mentor_inference_execution";let connectionPromise=null,model=null;const text=v=>typeof v==="string"?v.trim():"";const plain=v=>v&&typeof v.toObject==="function"?v.toObject():v;const iso=v=>{if(v===null||v===undefined||v==="")return "";const d=v instanceof Date?new Date(v):new Date(v);return Number.isNaN(d.getTime())?"":d.toISOString();};';
if(!candidate.includes(oldHead))throw new Error("candidate head anchor missing");
candidate=candidate.replace(oldHead,newHead);
const oldNormalize='||!Number.isSafeInteger(v.stagedFromLeaseGeneration)||v.stagedFromLeaseGeneration<1||!v.stagedAt||!v.resultPayload||digest(v.resultPayload)!==text(v.resultDigest))';
const newNormalize='||!Number.isSafeInteger(v.stagedFromLeaseGeneration)||v.stagedFromLeaseGeneration<1||!iso(v.stagedAt)||!v.resultPayload||digest(v.resultPayload)!==text(v.resultDigest))';
if(!candidate.includes(oldNormalize))throw new Error("candidate normalize anchor missing");
candidate=candidate.replace(oldNormalize,newNormalize);
candidate=candidate.replace('stagedAt:new Date(v.stagedAt).toISOString()','stagedAt:iso(v.stagedAt)');
fs.writeFileSync(candidatePath,candidate);

console.log("proof-time abyss patch applied");
