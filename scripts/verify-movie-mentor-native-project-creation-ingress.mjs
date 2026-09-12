import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createMovieMentorNativeProjectCreationAuthority,
  deriveNativeProjectCreationAuthorityId,
  inspectNativeProjectIdentity,
} from "../ai/MovieMentorNativeProjectCreationAuthority.js";

console.log("5A.25 — native project creation production ingress authority");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, "ai", "MovieMentorProjectOwnershipRegistry.js");
const SERVER = path.join(ROOT, "server.js");
const PROJECTS = path.join(ROOT, "movieMentorProjects.js");
const AUTHORITY = path.join(ROOT, "ai", "MovieMentorNativeProjectCreationAuthority.js");

const registrySource = fs.readFileSync(REGISTRY, "utf8");
const serverSource = fs.readFileSync(SERVER, "utf8");
const projectsSource = fs.readFileSync(PROJECTS, "utf8");
const authoritySource = fs.readFileSync(AUTHORITY, "utf8");

assert.match(registrySource,/async function establishNativeOwnership\s*\(/,"project ownership registry must expose native ownership establishment authority");
assert.match(registrySource,/type\)\s*!==\s*["']native-project-creation["']/,"native ownership establishment must require server-trusted native-project-creation authority");
assert.match(registrySource,/MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_CONFLICT/,"native ownership establishment must bind the exact principal and project");

const PROJECT_A = "movie-project-123e4567-e89b-42d3-a456-426614174000";
const PROJECT_B = "movie-project-123e4567-e89b-42d3-a456-426614174001";
const IDENTITY = Object.freeze({ domain:"iband.movie-mentor.project", schema:1, issuance:"secure-web-crypto", legacy:false });
assert.equal(inspectNativeProjectIdentity({projectId:PROJECT_A,identity:IDENTITY}).valid,true);
assert.equal(inspectNativeProjectIdentity({projectId:"movie-project-client-choice",identity:IDENTITY}).valid,false,"arbitrary client project ids must not cross native ownership establishment");
assert.equal(inspectNativeProjectIdentity({projectId:PROJECT_A,identity:{...IDENTITY,issuance:"legacy-preserved"}}).valid,false,"legacy identity must not enter native creation ceremony");

const calls=[];
const ownershipAuthority={
  async establishNativeOwnership(input){
    calls.push(structuredClone(input));
    return {
      status:calls.filter(call=>call.projectId===input.projectId&&call.principal?.principalId===input.principal?.principalId).length===1?"established":"already-established",
      ownership:{projectId:input.projectId,ownerPrincipalId:input.principal.principalId,ownershipRevision:1,ownershipReference:`ownership:${input.projectId}`,status:"active"},
    };
  },
};
const verifyCredential=async({credential,expectedIssuer,expectedAudience})=>{
  assert.equal(credential,"real-verifier-fixture-token");
  assert.equal(expectedIssuer,"https://issuer.example");
  assert.equal(expectedAudience,"movie-mentor");
  return {verified:true,subject:"creator-certified",issuer:"https://issuer.example",audience:"movie-mentor",verificationMethod:"RS256-pinned-public-key",verificationVersion:"1",sessionReference:"session-certified",authenticatedAt:"2026-09-12T00:00:00.000Z",expiresAt:"2099-01-01T00:00:00.000Z",active:true};
};
const authority=createMovieMentorNativeProjectCreationAuthority({verifyCredential,expectedIssuer:"https://issuer.example",expectedAudience:"movie-mentor",ownershipAuthority});
const request={headers:{authorization:"Bearer real-verifier-fixture-token"}};
const first=await authority.establishFromRequest({request,projectId:PROJECT_A,identity:IDENTITY,principalId:"attacker",authorityId:"client-minted"});
assert.equal(first.status,"established");
assert.equal(first.projectId,PROJECT_A);
assert.equal(first.ownership.projectId,PROJECT_A);
assert.equal(Object.hasOwn(first.ownership,"ownerPrincipalId"),false,"creator response must not expose durable principal identity");
assert.equal(calls[0].principal.authenticated,true);
assert.equal(calls[0].principal.principalId,"creator-certified","principal must derive from verified bearer credential only");
assert.equal(calls[0].establishmentAuthority.verified,true);
assert.equal(calls[0].establishmentAuthority.type,"native-project-creation");
assert.equal(calls[0].establishmentAuthority.projectId,PROJECT_A);
assert.equal(calls[0].establishmentAuthority.principalId,"creator-certified");
assert.match(calls[0].establishmentAuthority.authorityId,/^movie-mentor-native-project-creation:[0-9a-f]{64}$/);

await authority.establishFromRequest({request,projectId:PROJECT_A,identity:IDENTITY});
assert.equal(calls[1].establishmentAuthority.authorityId,calls[0].establishmentAuthority.authorityId,"same authenticated creator/project retry must converge on one establishment authority");
await authority.establishFromRequest({request,projectId:PROJECT_B,identity:IDENTITY});
assert.notEqual(calls[2].establishmentAuthority.authorityId,calls[0].establishmentAuthority.authorityId,"different project must receive different server authority");
assert.equal(deriveNativeProjectCreationAuthorityId({principalId:"creator-certified",projectId:PROJECT_A}),calls[0].establishmentAuthority.authorityId);

await assert.rejects(()=>authority.establishFromRequest({request:{headers:{}},projectId:PROJECT_A,identity:IDENTITY}),error=>error?.code==="MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED");
await assert.rejects(()=>authority.establishFromRequest({request,projectId:PROJECT_A,identity:{...IDENTITY,legacy:true}}),error=>error?.code==="MOVIE_MENTOR_NATIVE_PROJECT_IDENTITY_INVALID");

assert.match(authoritySource,/deriveMovieMentorPrincipal/,"native creation authority must use the certified deterministic principal path");
assert.match(authoritySource,/deriveNativeProjectCreationAuthorityId/,"server must derive establishment authority rather than accept it from the client");
assert.doesNotMatch(authoritySource,/establishmentAuthority:\s*[^O\n]*body/i,"client body must never become ownership establishment authority");
assert.match(projectsSource,/router\.post\(["']\/projects["']/,"production project router must expose POST /projects");
assert.match(projectsSource,/FORBIDDEN_CLIENT_AUTHORITY_FIELDS/,"HTTP ingress must reject client ownership/authority fields");
assert.match(projectsSource,/projectId:\s*body\.projectId[\s\S]*identity:\s*body\.identity/,"HTTP ingress may forward project identity, not client authority");
assert.match(serverSource,/createMovieMentorProjectOwnershipAuthority\(\)/,"server must own a durable project ownership authority instance");
assert.match(serverSource,/createMovieMentorNativeProjectCreationAuthority\([\s\S]*ownershipAuthority:movieMentorProjectOwnershipAuthority/,"production composition must bind native creation to the durable ownership authority");
assert.match(serverSource,/createMovieMentorCreatorRequestAuthority\([\s\S]*ownershipAuthority:movieMentorProjectOwnershipAuthority/,"turn authorization and native creation must read the same durable ownership authority");
assert.match(serverSource,/app\.use\(["']\/api\/movie-mentor["'],router\)/,"native project router must mount under the public creator gateway base path");
assert.ok(serverSource.indexOf("mountMovieMentorNativeProjectCreationIngress()")<serverSource.indexOf("mountMovieMentorCreatorGateway()"),"native ownership ingress must mount independently before inference gateway readiness");
assert.doesNotMatch(projectsSource,/req\.body[^\n]*(principalId|ownerPrincipalId|authorityId|establishmentAuthority)/,"production ingress must not consume client-minted ownership authority");

console.log("Movie Mentor native project creation ingress verification: PASS — authenticated principal + canonical client identity -> deterministic server authority -> durable create-once ownership, with no client-minted ownership authority.");
