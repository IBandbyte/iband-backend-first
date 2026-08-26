import { createHash } from "node:crypto";

const MOVIE_MENTOR_CONTINUATION_OBEDIENCE_VERSION = "1.1.0";
const CONTINUATION_OBEDIENCE_CONTRACT_VERSION = "1.1.0";

function cleanString(value){return typeof value === "string" ? value.trim() : "";}
function asArray(value){return Array.isArray(value) ? value : [];}
function clone(value){if(value===undefined)return undefined;try{return JSON.parse(JSON.stringify(value));}catch{return value;}}
function stable(value){if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;}
function digest(value){return createHash("sha256").update(stable(value)).digest("hex");}

function resolvedReferencesFrom(semantic={}){
 const candidates=asArray(semantic?.continuationReferences || semantic?.continuationReferenceResolutions || semantic?.resolvedContinuationReferences);
 return candidates.filter(item=>item && (item.status==="resolved" || item.resolved===true) && cleanString(item.expression || item.reference || item.id));
}
function canonicalReference(item,index){
 const expression=cleanString(item.expression || item.reference || item.id);
 const resolvedValue=item.resolvedValue ?? item.value ?? item.resolution ?? null;
 const valueDigest=digest(resolvedValue);
 const referenceId=cleanString(item.referenceId || item.id) || `continuation-${index+1}-${digest({expression,resolvedValue}).slice(0,24)}`;
 return {referenceId,expression,type:cleanString(item.type)||"continuation-reference",resolvedValue:clone(resolvedValue),resolvedValueDigest:valueDigest,authority:"validated-semantic-continuation",material:item.material!==false};
}
function buildContinuationObedienceEnvelope(semantic={}){
 const references=resolvedReferencesFrom(semantic).map(canonicalReference);
 return {version:MOVIE_MENTOR_CONTINUATION_OBEDIENCE_VERSION,contractVersion:CONTINUATION_OBEDIENCE_CONTRACT_VERSION,references,requiredReferenceIds:references.filter(r=>r.material).map(r=>r.referenceId),authority:{semanticResolutionImmutable:true,downstreamMayReinterpret:false,creatorTruthDominates:true}};
}
function validateObedienceClaims(claims,envelope,{allowNotApplicable=false,requireAll=true}={}){
 const issues=[];const expected=new Map(asArray(envelope?.references).map(r=>[r.referenceId,r]));const seen=new Set();
 for(const claim of asArray(claims)){
  const id=cleanString(claim?.referenceId);if(!expected.has(id)){issues.push(`unknown_continuation_reference:${id||"missing"}`);continue;}seen.add(id);const ref=expected.get(id);const status=cleanString(claim?.status);
  if(status==="not-applicable"&&allowNotApplicable)continue;
  if(status!=="obeyed"){issues.push(`continuation_reference_not_obeyed:${id}`);continue;}
  if(cleanString(claim?.resolvedValueDigest)!==ref.resolvedValueDigest)issues.push(`continuation_reference_value_drift:${id}`);
 }
 if(requireAll){for(const id of asArray(envelope?.requiredReferenceIds)){if(!seen.has(id))issues.push(`continuation_reference_proof_missing:${id}`);}}
 return {valid:issues.length===0,issues};
}
function assertObedienceClaims(claims,envelope,options={}){const result=validateObedienceClaims(claims,envelope,options);if(!result.valid){const error=new Error("Continuation reference obedience failed.");error.code="CONTINUATION_REFERENCE_OBEDIENCE_FAILED";error.validationIssues=result.issues;throw error;}return result;}

export {MOVIE_MENTOR_CONTINUATION_OBEDIENCE_VERSION,CONTINUATION_OBEDIENCE_CONTRACT_VERSION,buildContinuationObedienceEnvelope,validateObedienceClaims,assertObedienceClaims};
export default buildContinuationObedienceEnvelope;
