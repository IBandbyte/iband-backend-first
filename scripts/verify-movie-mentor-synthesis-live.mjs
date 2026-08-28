import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE=(process.env.IBAND_LIVE_BACKEND_URL||"https://iband-backend-first-1.onrender.com").replace(/\/$/,"");
const URL=`${BASE}/api/movie-mentor-synthesis/synthesize`;
const REPORT=process.env.IBAND_LIVE_REPORT_PATH||"verification-results/movie-mentor-synthesis-live.json";
const report={generatedAt:new Date().toISOString(),baseUrl:BASE,passed:false,status:null,publiclyIsolated:false,error:null};
function save(){mkdirSync(dirname(REPORT),{recursive:true});writeFileSync(REPORT,JSON.stringify(report,null,2)+"\n");}

try{
  const response=await fetch(URL,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({creatorMessage:"Public synthesis bypass probe"})});
  report.status=response.status;
  assert.equal(response.status,404,"standalone synthesis execution must not be publicly mounted");
  report.publiclyIsolated=true;
  report.passed=true;
}catch(error){
  report.error={message:error instanceof Error?error.message:String(error),code:error?.code||null};
  process.exitCode=1;
}finally{save();}
