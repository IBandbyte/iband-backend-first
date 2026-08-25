import{spawnSync}from"node:child_process";
const cases=[
["post-catastrophe-certification","scripts/verify-movie-mentor-post-catastrophe-recovery-certification.mjs"],
["retry-snapshot-lineage","scripts/verify-movie-mentor-recovery-retry-snapshot-lineage-race.mjs"],
["full-catastrophe","scripts/verify-movie-mentor-operations-catastrophe.mjs"]
];
const results=[];
for(const[name,file]of cases){const r=spawnSync(process.execPath,[file],{encoding:"utf8"});results.push({name,file,status:r.status,signal:r.signal,stdout:r.stdout?.trim()||"",stderr:r.stderr?.trim()||""});if(r.status!==0){console.error(`RECOVERY MATRIX FAILED: ${name}`);if(r.stdout)console.error(r.stdout);if(r.stderr)console.error(r.stderr);process.exit(r.status??1)}console.log(`RECOVERY MATRIX PASS: ${name}`)}
if(results.length!==cases.length||results.some(r=>r.status!==0))throw new Error("recovery regression matrix incomplete");
console.log(`RECOVERY CATASTROPHE REGRESSION MATRIX PASSED: ${results.length}/${cases.length} permanent suites green.`);
