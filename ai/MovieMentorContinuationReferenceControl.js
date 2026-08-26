import {
  selectCurrentRecommendationReference,
  recommendationResolvedValue,
} from "./MovieMentorRecommendationReferenceControl.js";

const MOVIE_MENTOR_CONTINUATION_REFERENCE_CONTROL_VERSION = "1.1.0";
const MOVIE_MENTOR_CONTINUATION_REFERENCE_SCHEMA = 1;
const CONTINUATION_REFERENCE_DOMAIN = "iband.movie-mentor.continuation-reference";

function clean(value){return typeof value==="string"?value.trim():"";}
function array(value){return Array.isArray(value)?value:[];}
function clone(value){if(value===undefined)return undefined;try{return JSON.parse(JSON.stringify(value));}catch{return value;}}
function timestamp(value){const n=Date.parse(value||"");return Number.isFinite(n)?n:0;}
function projectMatch(item,projectId){const pid=clean(projectId);if(!pid)return true;const direct=clean(item?.projectId||item?.metadata?.projectId);const related=array(item?.relatedProjectIds).map(clean);return direct?direct===pid:(related.length?related.includes(pid):true);}
function sortedNewest(items){return [...array(items)].sort((a,b)=>timestamp(b?.updatedAt||b?.createdAt)-timestamp(a?.updatedAt||a?.createdAt));}
function projectHistory(memoryContext={},projectId=null){const conversations=sortedNewest(array(memoryContext?.conversations).filter(item=>projectMatch(item,projectId)));const handoffs=sortedNewest(array(memoryContext?.sessionHandoffs).filter(item=>projectMatch(item,projectId)));return{conversations,handoffs};}
function latestEvidence(history){const conversation=history.conversations[0]||null;const handoff=history.handoffs[0]||null;return{conversation,handoff,lastCreatorMessage:clean(handoff?.value?.lastCreatorMessage||conversation?.creatorMessage),lastMentorResponse:clean(handoff?.value?.lastMentorResponse||conversation?.mentorResponse)};}
function extractNumberedOptions(text){const value=clean(text);if(!value)return[];const found=[];for(const line of value.split(/\r?\n/)){let m=line.match(/^\s*(\d{1,2})[.)]\s*(.+?)\s*$/);if(m)found.push({index:Number(m[1]),text:clean(m[2])});else{m=line.match(/^\s*(?:option|idea)\s*(\d{1,2})\s*[:\-]\s*(.+?)\s*$/i);if(m)found.push({index:Number(m[1]),text:clean(m[2])});}}
 const named=[['first',1],['second',2],['third',3]];for(const [word,index] of named){const re=new RegExp(`(?:^|[\\n.;])\\s*${word}(?:\\s+(?:idea|option))?\\s*[:\\-]\\s*([^\\n.;]+)`,`i`);const m=value.match(re);if(m&&!found.some(x=>x.index===index))found.push({index,text:clean(m[1])});}
 return found.filter(x=>x.text).sort((a,b)=>a.index-b.index);
}
function ordinalIndex(message){const m=clean(message).match(/\b(?:the\s+)?(first|second|third|1st|2nd|3rd|\d+)\s+(?:idea|option|one)\b/i);if(!m)return null;const token=m[1].toLowerCase();if(token==="first"||token==="1st")return 1;if(token==="second"||token==="2nd")return 2;if(token==="third"||token==="3rd")return 3;const n=Number(token);return Number.isSafeInteger(n)&&n>0?n:null;}
function explicitEntityCandidates(memoryContext={},projectId=null){const names=[];const add=(name,evidence)=>{const n=clean(name);if(n&&!names.some(x=>x.name.toLowerCase()===n.toLowerCase()))names.push({name:n,evidence:clean(evidence)||n});};for(const item of array(memoryContext?.projectMemories).filter(x=>projectMatch(x,projectId))){for(const ref of array(item?.metadata?.entityReferences))add(ref?.name||ref?.label,item?.content||item?.text||item?.title);add(item?.metadata?.entityName,item?.content||item?.text||item?.title);if(/character/i.test(clean(item?.category||item?.title)))add(item?.value?.name||item?.name,item?.content||item?.text||item?.title);}
 for(const item of array(memoryContext?.conversations).filter(x=>projectMatch(x,projectId))){for(const ref of array(item?.metadata?.entityReferences))add(ref?.name||ref?.label,item?.mentorResponse||item?.creatorMessage);}
 return names;
}
function ref({expression,type,status,resolvedValue=null,evidence=null,source=null,confidenceSource="model-provisional",reason=null}={}){return{domain:CONTINUATION_REFERENCE_DOMAIN,schema:MOVIE_MENTOR_CONTINUATION_REFERENCE_SCHEMA,expression:clean(expression)||null,type:clean(type)||null,status,resolvedValue:resolvedValue==null?null:clone(resolvedValue),evidence:clean(evidence)||null,source:clean(source)||null,confidenceSource,reason:clean(reason)||null};}
function ambiguity(expression,type,reason){return ref({expression,type,status:"ambiguous",reason,confidenceSource:"model-provisional"});}
function recommendationDemonstrative(message){const value=clean(message);if(!value)return false;return /\b(?:yes[,.! ]*)?(?:do|use|go with)\s+that\b/i.test(value)||/\b(?:no[,.! ]*)?(?:not|don['’]?t|do not|skip)\s+that\b/i.test(value);}
function positiveRecommendationAdoption(message){return /\b(?:yes[,.! ]*)?(?:do|use|go with)\s+that\b/i.test(clean(message));}
function resolveContinuationReferences({creatorMessage,projectId=null,memoryContext={},creatorConfirmedContext=[]}={}){
 const message=clean(creatorMessage);const history=projectHistory(memoryContext,projectId);const evidence=latestEvidence(history);const references=[];const clarifications=[];
 if(!message)return{version:MOVIE_MENTOR_CONTINUATION_REFERENCE_CONTROL_VERSION,domain:CONTINUATION_REFERENCE_DOMAIN,schema:MOVIE_MENTOR_CONTINUATION_REFERENCE_SCHEMA,references,clarifications,hasMaterialAmbiguity:false};
 const addAmbiguous=(expression,type,reason,question)=>{references.push(ambiguity(expression,type,reason));clarifications.push({key:`continuation.${type}`,expression,question,reason,material:true});};
 if(recommendationDemonstrative(message)){
   const recommendationReference=selectCurrentRecommendationReference({memoryContext,projectId});
   if(recommendationReference.status==="resolved"){
     const recommendation=recommendationResolvedValue(recommendationReference.evidence);
     references.push(ref({expression:"that",type:"journey-recommendation",status:"resolved",resolvedValue:recommendation,evidence:clean(recommendation.recommendedNextStep)||clean(recommendation.explanation)||recommendationReference.recommendationId,source:"project-memory:journey-recommendation",confidenceSource:"creator-confirmed"}));
   }else if(recommendationReference.status==="ambiguous"){
     addAmbiguous("that","journey-recommendation","More than one current project-scoped Journey recommendation could match ‘that’.","Which recommendation do you mean?");
   }else if(positiveRecommendationAdoption(message)){
     if(evidence.lastMentorResponse)references.push(ref({expression:"that",type:"prior-mentor-proposal",status:"resolved",resolvedValue:evidence.lastMentorResponse,evidence:evidence.lastMentorResponse,source:"project-conversation",confidenceSource:"creator-confirmed"}));
     else addAmbiguous("that","prior-mentor-proposal","No project-scoped Mentor proposal is available to identify what ‘that’ refers to.","What would you like me to do from the previous idea?");
   }else{
     addAmbiguous("that","journey-recommendation","No current project-scoped Journey recommendation is available to identify what ‘that’ refers to.","Which suggestion are you rejecting?");
   }
 }
 if(/\b(?:carry on|continue|pick up)(?:\s+from)?\s+there\b/i.test(message)){
   const point=clean(evidence.handoff?.content)||evidence.lastMentorResponse||evidence.lastCreatorMessage;
   if(point)references.push(ref({expression:"there",type:"continuation-position",status:"resolved",resolvedValue:{handoffId:evidence.handoff?.id||null,conversationId:evidence.conversation?.id||evidence.handoff?.value?.conversationId||null,position:point},evidence:point,source:evidence.handoff?"project-session-handoff":"project-conversation",confidenceSource:"creator-confirmed"}));
   else addAmbiguous("there","continuation-position","No project-scoped conversation or session handoff establishes a continuation position.","Which point would you like to continue from?");
 }
 const ordinal=ordinalIndex(message);if(ordinal){const options=extractNumberedOptions(evidence.lastMentorResponse);const option=options.find(x=>x.index===ordinal);const expression=message.match(/\b(?:the\s+)?(?:first|second|third|1st|2nd|3rd|\d+)\s+(?:idea|option|one)\b/i)?.[0]||`option ${ordinal}`;if(option)references.push(ref({expression,type:"ordinal-option",status:"resolved",resolvedValue:{index:ordinal,text:option.text},evidence:evidence.lastMentorResponse,source:"project-conversation",confidenceSource:"creator-confirmed"}));else addAmbiguous(expression,"ordinal-option",`The current project history does not contain an unambiguous option ${ordinal}.`,`Which idea do you mean by “${expression}”?`);}
 const pronounMatch=message.match(/\b(her|she|him|he|them|they)\b/i);if(pronounMatch&&/\b(?:actually|make|change|give|have|let)\b/i.test(message)){
   const expression=pronounMatch[1];const entities=explicitEntityCandidates(memoryContext,projectId);if(entities.length===1)references.push(ref({expression,type:"entity-pronoun",status:"resolved",resolvedValue:{name:entities[0].name},evidence:entities[0].evidence,source:"project-memory",confidenceSource:"creator-confirmed"}));else if(entities.length>1)addAmbiguous(expression,"entity-pronoun",`More than one project-scoped entity could match “${expression}”.`,`Who do you mean by “${expression}”?`);else addAmbiguous(expression,"entity-pronoun",`No explicit project-scoped entity evidence identifies who “${expression}” refers to.`,`Who do you mean by “${expression}”?`);
 }
 const currentCreatorKeys=new Set(array(creatorConfirmedContext).filter(x=>clean(x?.key)).map(x=>clean(x.key)));
 return{version:MOVIE_MENTOR_CONTINUATION_REFERENCE_CONTROL_VERSION,domain:CONTINUATION_REFERENCE_DOMAIN,schema:MOVIE_MENTOR_CONTINUATION_REFERENCE_SCHEMA,references,clarifications,hasMaterialAmbiguity:clarifications.some(x=>x.material!==false),currentCreatorAuthorityKeys:[...currentCreatorKeys]};
}
function mergeContinuationIntoSemanticIntelligence(semanticIntelligence={},resolution={}){const next=clone(semanticIntelligence)||{};next.continuationReferences=clone(array(resolution?.references));if(resolution?.hasMaterialAmbiguity){next.clarificationNeeded=[...array(next.clarificationNeeded),...array(resolution.clarifications)];next.readyToAdvance=false;}return next;}

export{MOVIE_MENTOR_CONTINUATION_REFERENCE_CONTROL_VERSION,MOVIE_MENTOR_CONTINUATION_REFERENCE_SCHEMA,CONTINUATION_REFERENCE_DOMAIN,projectHistory,extractNumberedOptions,recommendationDemonstrative,positiveRecommendationAdoption,resolveContinuationReferences,mergeContinuationIntoSemanticIntelligence};
export default resolveContinuationReferences;
