import fs from "node:fs";

function replaceIfNeeded(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`${label} anchor missing`);
  return source.replace(oldText, newText);
}

const candidatePath = "ai/MovieMentorResultCandidateMongoStore.js";
let candidate = fs.readFileSync(candidatePath, "utf8");
candidate = replaceIfNeeded(candidate, 'const VERSION="1.2.0"', 'const VERSION="1.3.0"', "candidate version");
candidate = replaceIfNeeded(
  candidate,
  'const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}function mongoUri()',
  'const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}function instant(v){const normalized=iso(v);if(!normalized)fail("MOVIE_MENTOR_RESULT_CANDIDATE_TIME_INVALID","Result candidate staging time is invalid.",{retryable:false});return new Date(normalized);}function mongoUri()',
  "candidate instant"
);
candidate = replaceIfNeeded(candidate, 'stagedAt:new Date(now())', 'stagedAt:instant(now())', "candidate write clock");
fs.writeFileSync(candidatePath, candidate);

const canonicalAuthorityPath = "ai/MovieMentorCanonicalResultAuthority.js";
let canonicalAuthority = fs.readFileSync(canonicalAuthorityPath, "utf8");
canonicalAuthority = replaceIfNeeded(canonicalAuthority, 'const VERSION="1.5.0"', 'const VERSION="1.6.0"', "canonical authority version");
canonicalAuthority = replaceIfNeeded(
  canonicalAuthority,
  'function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}function canonicalize(value)',
  'function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}function instant(v){if(v===null||v===undefined||v==="")fail("MOVIE_MENTOR_CANONICAL_RESULT_TIME_INVALID","Canonical result commit time is invalid.",{retryable:false});const d=v instanceof Date?new Date(v):new Date(v);if(Number.isNaN(d.getTime()))fail("MOVIE_MENTOR_CANONICAL_RESULT_TIME_INVALID","Canonical result commit time is invalid.",{retryable:false});return d;}function canonicalize(value)',
  "canonical authority instant"
);
canonicalAuthority = replaceIfNeeded(canonicalAuthority, 'existing?.committedAt||new Date(now()).toISOString()', 'existing?.committedAt||instant(now()).toISOString()', "canonical write clock");
fs.writeFileSync(canonicalAuthorityPath, canonicalAuthority);

const settlementPath = "ai/MovieMentorInferenceSettlementMongoStore.js";
let settlement = fs.readFileSync(settlementPath, "utf8");
settlement = replaceIfNeeded(settlement, 'const VERSION="1.6.0"', 'const VERSION="1.7.0"', "settlement version");
settlement = replaceIfNeeded(
  settlement,
  'function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}function mongoUri()',
  'function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}function settlementInstant(v){const normalized=iso(v);if(!normalized)fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_TIME_INVALID","Inference settlement time is invalid.",{retryable:false});return new Date(normalized);}function mongoUri()',
  "settlement instant"
);
const clockCount = settlement.split('new Date(now())').length - 1;
if (clockCount > 0) settlement = settlement.replaceAll('new Date(now())', 'settlementInstant(now())');
if (!settlement.includes('settlementInstant(now())')) throw new Error("settlement validated write clock missing");
if (settlement.includes('new Date(now())')) throw new Error("settlement unsafe write clock remains");
fs.writeFileSync(settlementPath, settlement);

const settledGatePath = "scripts/verify-movie-mentor-settled-execution-authority.mjs";
let settledGate = fs.readFileSync(settledGatePath, "utf8");
settledGate = replaceIfNeeded(
  settledGate,
  "const freshBarrier = settlementStore.indexOf('const settledAt=new Date(now());const barrier=');",
  "const freshBarrier = settlementStore.indexOf('const settledAt=settlementInstant(now());const barrier=');",
  "settled gate fresh barrier"
);
const oldAssertion = 'assert.ok(consumedBranch > 0 && freshBarrier > consumedBranch && entitlementDebit > freshBarrier && reservationConsume > entitlementDebit,';
const newAssertion = 'assert.match(settlementStore,/function settlementInstant\\(v\\)/, "fresh settlement time must pass through fail-closed clock validation");\nassert.doesNotMatch(settlementStore,/new Date\\(now\\(\\)\\)/, "settlement may not manufacture proof from an absent clock");\nassert.ok(consumedBranch > 0 && freshBarrier > consumedBranch && entitlementDebit > freshBarrier && reservationConsume > entitlementDebit,';
settledGate = replaceIfNeeded(settledGate, oldAssertion, newAssertion, "settled gate clock assertions");
fs.writeFileSync(settledGatePath, settledGate);

console.log(`proof creation-time hardening converged; newly replaced settlement clocks=${clockCount}`);
