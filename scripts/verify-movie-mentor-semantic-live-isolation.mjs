import assert from "node:assert/strict";

const BASE=(process.env.IBAND_LIVE_BACKEND_URL||"https://iband-backend-first-1.onrender.com").replace(/\/$/,"");
const URL=`${BASE}/api/movie-mentor-semantic/interpret`;

const response=await fetch(URL,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({message:"Public semantic bypass probe"})});
assert.equal(response.status,404,"standalone semantic interpretation must not be publicly mounted");
console.log("✓ standalone semantic route is not publicly mounted");
