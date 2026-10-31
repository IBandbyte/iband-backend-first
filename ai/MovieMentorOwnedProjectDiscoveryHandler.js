// Owner-scoped, read-only project discovery. HTTP authentication and physical
// ownership listing are injected; this boundary never accepts client owner IDs.
const clean=value=>typeof value==="string"?value.trim():"";
function fail(code,message){throw Object.assign(new Error(message),{code});}
function createMovieMentorOwnedProjectDiscoveryHandler({authenticate,listOwnedProjects,authorizeProject}={}){
 if(typeof authenticate!=="function"||typeof listOwnedProjects!=="function"||typeof authorizeProject!=="function")fail("MOVIE_MENTOR_DISCOVERY_DEPENDENCY_REQUIRED","Owner discovery requires authentication, owned-project listing and authorization.");
 return async function discover({request}={}){
  const principal=await authenticate({request});
  const principalId=clean(principal?.principalId);
  if(principal?.authenticated!==true||!principalId)fail("MOVIE_MENTOR_DISCOVERY_AUTH_REQUIRED","Authenticated principal is required for project discovery.");
  const records=await listOwnedProjects({principalId});
  if(!Array.isArray(records))fail("MOVIE_MENTOR_DISCOVERY_INVALID_LIST","Ownership listing returned an invalid result.");
  const ids=new Set(),result=[];
  for(const record of records){
   const projectId=clean(record?.projectId);
   if(!projectId||ids.has(projectId))fail("MOVIE_MENTOR_DISCOVERY_INVALID_PROJECT","Ownership listing contained a missing or duplicate project identity.");
   ids.add(projectId);
   const authority=await authorizeProject({principal,projectId});
   if(authority?.authorized!==true||clean(authority.projectId)!==projectId)fail("MOVIE_MENTOR_DISCOVERY_OWNERSHIP_NOT_PROVEN","Project ownership was not confirmed before discovery.");
   result.push(Object.freeze({projectId}));
  }
  return Object.freeze(result);
 };
}
export{createMovieMentorOwnedProjectDiscoveryHandler};
export default createMovieMentorOwnedProjectDiscoveryHandler;
