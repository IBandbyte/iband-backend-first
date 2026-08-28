import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE_URL=(process.env.IBAND_LIVE_BACKEND_URL||"https://iband-backend-first-1.onrender.com").replace(/\/$/,"");
const HEALTH_URL=`${BASE_URL}/api/movie-mentor-specialists/health`;
const EXECUTE_URL=`${BASE_URL}/api/movie-mentor-specialists/execute`;
const REPORT_PATH=process.env.IBAND_LIVE_REPORT_PATH||"verification-results/movie-mentor-specialists-live.json";
const report={generatedAt:new Date().toISOString(),baseUrl:BASE_URL,passed:false,healthStatus:null,executeStatus:null,publiclyIsolated:false,error:null};
function writeReport(){mkdirSync(dirname(REPORT_PATH),{recursive:true});writeFileSync(REPORT_PATH,`${JSON.stringify(report,null,2)}\n`,`utf8`);}

async function run(){
  const healthResponse=await fetch(HEALTH_URL,{headers:{Accept:"application/json"}});
  const executeResponse=await fetch(EXECUTE_URL,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({plan:{workOrders:[]}})});
  report.healthStatus=healthResponse.status;
  report.executeStatus=executeResponse.status;
  assert.equal(healthResponse.status,404,"standalone specialist health must not be publicly mounted");
  assert.equal(executeResponse.status,404,"standalone specialist execution must not be publicly mounted");
  report.publiclyIsolated=true;
  report.passed=true;
}

try{await run();}catch(error){report.error={message:error instanceof Error?error.message:String(error),code:error?.code||null};process.exitCode=1;}finally{writeReport();}
