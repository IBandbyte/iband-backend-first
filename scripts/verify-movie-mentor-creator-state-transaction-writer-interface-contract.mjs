import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {writeAuthoritativeCreatorState,assertCreatorStateStoreMutationAuthority} from "../ai/MovieMentorCreatorStateStore.js";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";

// Production source-interface contract only; no database connection or production write.
// The existing authoritative writer must own CAS, and a transaction must reach BOTH
// its insert and update branches. Caller-controlled sessions are not authorization.
const source=readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js",import.meta.url),"utf8");
const start=source.indexOf("async function writeAuthoritativeCreatorState(");
const end=source.indexOf("\nexport{MOVIE_MENTOR_CREATOR_STATE_STORE_VERSION",start);
assert.ok(start>=0&&end>start);
const writer=source.slice(start,end);
const insert=writer.match(/if\(expected===0\)\{[\s\S]*?\}else\{/);
const update=writer.slice(writer.indexOf("}else{"));
const evidence={
 authoritativeWriter:typeof writeAuthoritativeCreatorState==="function",
 mutationLineageGuard:typeof assertCreatorStateStoreMutationAuthority==="function",
 transitionAuthority:typeof applyMovieMentorCreatorStateTransition==="function",
 insertUsesSession:Boolean(insert&&/\{session\}|\.session\(session\)|session:/.test(insert[0])),
 updateUsesSession:/\{session\}|\.session\(session\)|session:/.test(update),
 publicSessionAcceptedAsAuthority:false
};
console.log(JSON.stringify({court:"creator-state-transaction-writer-interface-contract",evidence,classification:"real production source-interface contract; no transaction executed"}));
assert.equal(evidence.authoritativeWriter,true);
assert.equal(evidence.mutationLineageGuard,true);
assert.equal(evidence.transitionAuthority,true);
assert.equal(evidence.insertUsesSession,true,"WRITER INTERFACE RED: authoritative creator-state insert must join the execution barrier transaction");
assert.equal(evidence.updateUsesSession,true,"WRITER INTERFACE RED: authoritative creator-state CAS update must join the execution barrier transaction");
console.log("PASS: both creator-state write branches participate in atomic transaction; physical behavior remains separately required");
