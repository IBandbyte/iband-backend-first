import fs from "node:fs";

const path="ai/MovieMentorCanonicalResultMongoStore.js";
let source=fs.readFileSync(path,"utf8");
function replaceIfNeeded(oldText,newText,label){
  if(source.includes(newText))return;
  if(!source.includes(oldText))throw new Error(`${label} anchor missing`);
  source=source.replace(oldText,newText);
}
replaceIfNeeded('const VERSION="1.4.0"','const VERSION="1.5.0"','version');
replaceIfNeeded(
  'function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}\nfunction mongoUri()',
  'function fail(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);throw e;}\nfunction instant(v){const normalized=iso(v);if(!normalized)fail("MOVIE_MENTOR_CANONICAL_RESULT_TIME_INVALID","Canonical result persistence requires a valid committedAt timestamp.",{retryable:false});return new Date(normalized);}\nfunction mongoUri()',
  'instant helper'
);
source=source.replaceAll('committedAt:new Date(record.committedAt)','committedAt:instant(record.committedAt)');
if(source.includes('committedAt:new Date(record.committedAt)'))throw new Error('unsafe record clock remains');
if(!source.includes('committedAt:instant(record.committedAt)'))throw new Error('validated store clock missing');
fs.writeFileSync(path,source);
console.log('canonical result store clock hardening applied');
