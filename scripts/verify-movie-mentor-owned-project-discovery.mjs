import assert from "node:assert/strict";
import {createMovieMentorOwnedProjectDiscoveryHandler} from "../ai/MovieMentorOwnedProjectDiscoveryHandler.js";
const owner={authenticated:true,principalId:"creator-a"};
const other={authenticated:true,principalId:"creator-b"};
const ownership=[{projectId:"film-a",ownerPrincipalId:"creator-a"},{projectId:"film-b",ownerPrincipalId:"creator-b"}];
let principal=owner;
const handler=createMovieMentorOwnedProjectDiscoveryHandler({
  authenticate:async()=>principal,
  listOwnedProjects:async({principalId})=>ownership.filter(p=>p.ownerPrincipalId===principalId).map(p=>({projectId:p.projectId})),
  authorizeProject:async({principal:requestPrincipal,projectId})=>({authorized:ownership.some(p=>p.projectId===projectId&&p.ownerPrincipalId===requestPrincipal.principalId),projectId})
});
assert.deepEqual(await handler({request:{query:{ownerPrincipalId:"creator-b"}}}),[{projectId:"film-a"}],"query parameters must not change the verified owner");
principal=other;
assert.deepEqual(await handler({request:{}}),[{projectId:"film-b"}],"another owner must see only their projects");
principal={authenticated:false,principalId:"creator-a"};
await assert.rejects(()=>handler({request:{}}),/auth|principal/i);
console.log("GREEN: authenticated project discovery is owner-scoped and reauthorized.");
