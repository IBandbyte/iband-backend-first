import {deriveMovieMentorPrincipal} from "./MovieMentorDeterministicPrincipalAdapter.js";

const VERSION="1.0.0";
const DOMAIN="iband.movie-mentor.creator-commercial-request-authority";
function text(value){return typeof value==="string"?value.trim():"";}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}

function createMovieMentorCreatorCommercialRequestAuthority({verifyCredential=null,expectedIssuer=null,expectedAudience=null,now=()=>new Date(),derivePrincipal=deriveMovieMentorPrincipal}={}){
  if(typeof verifyCredential!=="function")fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_AUTH_VERIFIER_REQUIRED","Creator commercial requests require deterministic credential verification.");
  if(typeof derivePrincipal!=="function")fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_PRINCIPAL_ADAPTER_REQUIRED","Creator commercial requests require deterministic principal derivation.");
  async function authorize({request=null}={}){
    const principal=await derivePrincipal({request,verifyCredential,expectedIssuer:text(expectedIssuer)||null,expectedAudience:text(expectedAudience)||null,now:now()});
    const principalId=text(principal?.principalId);
    if(principal?.authenticated!==true||!principalId)fail("MOVIE_MENTOR_CREATOR_COMMERCIAL_AUTHORITY_INVALID","Credential verification did not produce an authenticated creator principal.");
    return Object.freeze({version:VERSION,domain:DOMAIN,authorized:true,principal,principalId,authenticationSource:text(principal.authenticationSource)||null});
  }
  return Object.freeze({version:VERSION,domain:DOMAIN,authorize});
}

export{VERSION as MOVIE_MENTOR_CREATOR_COMMERCIAL_REQUEST_AUTHORITY_VERSION,DOMAIN as MOVIE_MENTOR_CREATOR_COMMERCIAL_REQUEST_AUTHORITY_DOMAIN,createMovieMentorCreatorCommercialRequestAuthority};
export default createMovieMentorCreatorCommercialRequestAuthority;
