import{spawnSync}from"node:child_process";
const seams=[
["creator-revision-barrier","scripts/verify-movie-mentor-creator-revision-barrier.mjs"],
["creator-branch-convergence","scripts/verify-movie-mentor-creator-branch-convergence.mjs"],
["creator-soul-custody","scripts/verify-movie-mentor-operations-soul.mjs"],
["infinity-gauntlet","scripts/verify-movie-mentor-operations-infinity-gauntlet.mjs"],
["atomic-gauntlet","scripts/verify-movie-mentor-operations-atomic-gauntlet.mjs"],
["distributed-effects","scripts/verify-movie-mentor-operations-distributed-effects.mjs"],
["reconciliation-lease","scripts/verify-movie-mentor-operations-reconciliation-lease.mjs"],
["lease-authority-quorum","scripts/verify-movie-mentor-operations-lease-authority-quorum.mjs"],
["authority-reentry","scripts/verify-movie-mentor-operations-authority-reentry.mjs"],
["recovery-stability","scripts/verify-movie-mentor-operations-recovery-stability.mjs"],
["recovery-catastrophe-matrix","scripts/verify-movie-mentor-recovery-catastrophe-regression-matrix.mjs"]
];
const required=new Set(seams.map(([name])=>name));
const results=[];
for(const[name,file]of seams){const r=spawnSync(process.execPath,[file],{encoding:"utf8"});results.push({name,file,status:r.status,signal:r.signal});if(r.status!==0){console.error(`CROSS-LAYER CATASTROPHE FAILED AT SEAM: ${name}`);if(r.stdout)console.error(r.stdout.trim());if(r.stderr)console.error(r.stderr.trim());process.exit(r.status??1)}console.log(`CROSS-LAYER SEAM PASS: ${name}`)}
const passed=new Set(results.filter(r=>r.status===0).map(r=>r.name));for(const seam of required)if(!passed.has(seam))throw new Error(`cross-layer catastrophe seam escaped verification: ${seam}`);
if(results.length!==seams.length)throw new Error("cross-layer catastrophe matrix incomplete");
console.log(`ADVERSARIAL CROSS-LAYER CATASTROPHE v2 PASSED: ${results.length}/${seams.length} seam families green from creator truth through globally recovered durability.`);
