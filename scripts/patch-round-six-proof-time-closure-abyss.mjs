import fs from "node:fs";

const closurePath="ai/MovieMentorInferenceExecutionClosureAuthority.js";
const spendPath="ai/MovieMentorInferenceSpendMongoStore.js";

let closure=fs.readFileSync(closurePath,"utf8");
const oldInstant='function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}function instant(v){const d=v instanceof Date?new Date(v):new Date(v);if(Number.isNaN(d.getTime()))fail("MOVIE_MENTOR_INFERENCE_CLOSURE_TIME_INVALID","Closure time is invalid.");return d;}';
const newInstant='function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}function instant(v){if(v===null||v===undefined||v==="")fail("MOVIE_MENTOR_INFERENCE_CLOSURE_TIME_INVALID","Closure time is invalid.");const d=v instanceof Date?new Date(v):new Date(v);if(Number.isNaN(d.getTime()))fail("MOVIE_MENTOR_INFERENCE_CLOSURE_TIME_INVALID","Closure time is invalid.");return d;}';
if(!closure.includes(oldInstant))throw new Error("closure instant anchor missing");
closure=closure.replace(oldInstant,newInstant);
fs.writeFileSync(closurePath,closure);

let spend=fs.readFileSync(spendPath,"utf8");
spend=spend.replace('const VERSION="1.4.0"','const VERSION="1.5.0"');
const oldHelpers='function text(v){return typeof v==="string"?v.trim():"";} function units(v){return Number.isSafeInteger(v)&&v>0?v:null;}';
const newHelpers='function text(v){return typeof v==="string"?v.trim():"";} function units(v){return Number.isSafeInteger(v)&&v>0?v:null;} function iso(v){if(v===null||v===undefined||v==="")return null;const d=v instanceof Date?new Date(v):new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();}';
if(!spend.includes(oldHelpers))throw new Error("spend helper anchor missing");
spend=spend.replace(oldHelpers,newHelpers);
const oldNormalize='function normalizeReservation(record){const v=plain(record),status=text(v?.status);if(!v||v.domain!==DOMAIN||v.schema!==SCHEMA||!text(v.reservationId)||!text(v.principalId)||!text(v.projectId)||!text(v.operation)||!units(v.units)||!Number.isSafeInteger(v.entitlementRevision)||v.entitlementRevision<1||!["reserved","consumed","released"].includes(status))fail("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID","Durable inference spend reservation is malformed.");return Object.freeze({reservationId:text(v.reservationId),principalId:text(v.principalId),projectId:text(v.projectId),operation:text(v.operation),units:v.units,entitlementRevision:v.entitlementRevision,status,reservedAt:v.reservedAt?new Date(v.reservedAt).toISOString():null,settledAt:v.settledAt?new Date(v.settledAt).toISOString():null,settlementReason:text(v.settlementReason)||null,settlementExecutionId:text(v.settlementExecutionId)||null,settlementResultReference:text(v.settlementResultReference)||null,settlementCandidateReference:text(v.settlementCandidateReference)||null,settlementResultDigest:text(v.settlementResultDigest)||null});}';
const newNormalize='function normalizeReservation(record){const v=plain(record),status=text(v?.status),reservedAt=iso(v?.reservedAt),settledAt=iso(v?.settledAt);if(!v||v.domain!==DOMAIN||v.schema!==SCHEMA||!text(v.reservationId)||!text(v.principalId)||!text(v.projectId)||!text(v.operation)||!units(v.units)||!Number.isSafeInteger(v.entitlementRevision)||v.entitlementRevision<1||!["reserved","consumed","released"].includes(status)||!reservedAt||(v.settledAt!==null&&v.settledAt!==undefined&&v.settledAt!==""&&!settledAt))fail("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID","Durable inference spend reservation is malformed.");return Object.freeze({reservationId:text(v.reservationId),principalId:text(v.principalId),projectId:text(v.projectId),operation:text(v.operation),units:v.units,entitlementRevision:v.entitlementRevision,status,reservedAt,settledAt,settlementReason:text(v.settlementReason)||null,settlementExecutionId:text(v.settlementExecutionId)||null,settlementResultReference:text(v.settlementResultReference)||null,settlementCandidateReference:text(v.settlementCandidateReference)||null,settlementResultDigest:text(v.settlementResultDigest)||null});}';
if(!spend.includes(oldNormalize))throw new Error("spend normalize anchor missing");
spend=spend.replace(oldNormalize,newNormalize);
fs.writeFileSync(spendPath,spend);

console.log("closure/reservation proof-time hardening applied");
