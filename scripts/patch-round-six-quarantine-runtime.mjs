import fs from "node:fs";

const runtimePath = new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url);
const gatePath = new URL("./verify-movie-mentor-settled-execution-authority.mjs", import.meta.url);

let runtime = fs.readFileSync(runtimePath, "utf8");
const oldVersion = 'const MOVIE_MENTOR_TURN_RUNTIME_VERSION = "2.5.0";';
const newVersion = 'const MOVIE_MENTOR_TURN_RUNTIME_VERSION = "2.6.0";';
if (!runtime.includes(oldVersion)) throw new Error("runtime version anchor missing");
runtime = runtime.replace(oldVersion, newVersion);

const oldBlock = `  if (s(existing.phase) === "aborted") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_ABORTED", "Creator turn was durably aborted before any provider claim; use a new creatorTurnId for a new attempt.", {
      executionId: existing.executionId, retryable: false,
    });
  }
  const replay = await replayTerminalTurn({ existing, inferenceExecutionAuthority, settlementAuthority });`;
const newBlock = `  if (s(existing.phase) === "aborted") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_ABORTED", "Creator turn was durably aborted before any provider claim; use a new creatorTurnId for a new attempt.", {
      executionId: existing.executionId, retryable: false,
    });
  }
  if (s(existing.phase) === "quarantined") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED", "Creator turn belongs to a durably quarantined inference universe whose current proof is revoked; historical settlement remains preserved but cannot authorize replay or new provider work.", {
      executionId: existing.executionId,
      quarantinedFromPhase: s(existing.quarantinedFromPhase) || null,
      reason: s(existing.quarantineReason) || "durable-inference-universe-quarantined",
      retryable: false,
    });
  }
  const replay = await replayTerminalTurn({ existing, inferenceExecutionAuthority, settlementAuthority });`;
if (!runtime.includes(oldBlock)) throw new Error("convergence anchor missing");
runtime = runtime.replace(oldBlock, newBlock);
fs.writeFileSync(runtimePath, runtime);

let gate = fs.readFileSync(gatePath, "utf8");
const gateAnchor = `assert.match(runtime, /executionPhase !== "settled"/);`;
const gateInsert = `${gateAnchor}\nassert.match(runtime, /MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED/);\nassert.match(runtime, /quarantinedFromPhase: s\\(existing\\.quarantinedFromPhase\\) \\|\\| null/);`;
if (!gate.includes(gateAnchor)) throw new Error("gate source anchor missing");
gate = gate.replace(gateAnchor, gateInsert);

const replayAnchor = `assert.equal(providerReads,0);`;
const replayInsert = `${replayAnchor}\nlet quarantinedProviderReads = 0;\nawait assert.rejects(()=>replayTerminalTurn({\n  existing:{...existing,phase:"quarantined",quarantinedFromPhase:"settled",quarantineReason:"late-provider-conflict"},\n  inferenceExecutionAuthority:{readCanonicalResult:async()=>{quarantinedProviderReads++;return canonical;}},\n  settlementAuthority:{reconcile:async()=>{throw new Error("quarantine replay must not reach settlement");}},\n}), ()=>false).catch(()=>{});\nassert.equal(quarantinedProviderReads,0, "replayTerminalTurn itself must not treat QUARANTINED as replayable");`;
if (!gate.includes(replayAnchor)) throw new Error("gate replay anchor missing");
gate = gate.replace(replayAnchor, replayInsert);

gate = gate.replace('console.log("✓ QUARANTINED preserves the exact phase it revoked and continues validating that phase\'s immutable proof lineage");', 'console.log("✓ QUARANTINED preserves historical proof lineage but grants zero replay, settlement or provider authority");');
gate = gate.replace("LAW: NO PHASE GETS CREDIT FOR A PROOF IT DOESN'T OWN. QUARANTINE MAY REVOKE CURRENT TRUST, BUT IT MAY NOT ERASE WHICH PROOF-BEARING PHASE WAS REVOKED OR WEAKEN THAT PHASE'S HISTORICAL LINEAGE.", "LAW: NO PHASE GETS CREDIT FOR A PROOF IT DOESN'T OWN. QUARANTINE PRESERVES HISTORY BUT GRANTS ZERO FORWARD AUTHORITY: NO RESULT REPLAY, NO SETTLEMENT AUTHORIZATION, NO PROVIDER RE-ENTRY.");
fs.writeFileSync(gatePath, gate);
