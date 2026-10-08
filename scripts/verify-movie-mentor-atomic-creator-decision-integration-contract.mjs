import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import {writeAuthoritativeCreatorState} from "../ai/MovieMentorCreatorStateStore.js";

// VERIFIER-FIRST CONTRACT: real exported production interfaces; no database connection,
// no production writes, no synthetic green standing in for integration.
const store=createMovieMentorInferenceExecutionMongoStore({mongoModel:{},connect:async()=>{}});
const capabilities={
  atomicCreatorDecision:typeof store.commitCreatorDecisionAtomically==="function",
  genuineLeaseAuthority:typeof createMovieMentorInferenceExecutionLeaseAuthority==="function",
  authoritativeCreatorStateWriter:typeof writeAuthoritativeCreatorState==="function"
};
console.log(JSON.stringify({court:"atomic-creator-decision-production-integration-contract",capabilities,classification:"production-interface contract; NOT a physical transaction or end-to-end integration court"}));
assert.equal(capabilities.genuineLeaseAuthority,true);
assert.equal(capabilities.authoritativeCreatorStateWriter,true);
assert.equal(capabilities.atomicCreatorDecision,true,
 "INTEGRATION CONTRACT RED: production execution store must expose a server-controlled atomic creator-decision commit capability before the stale-first-commit defect can be repaired");
console.log("PASS: production atomic creator-decision integration capability is present; behavioral physical tests remain independently required");
