const MOVIE_MENTOR_CREATOR_TRUTH_VIEW_VERSION="1.0.0";
function s(v){return typeof v==="string"?v.trim():"";}
function a(v){return Array.isArray(v)?v:[];}
function clone(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v));}catch{return v;}}
function isDecision(item={}){return !!(s(item?.decisionId)||s(item?.decisionKey)||s(item?.key).startsWith("creatorDecision."));}
function classifyCreatorTruth(context=[]){const active=[],historical=[],rejected=[];for(const raw of a(context)){const item=clone(raw);if(!item||typeof item!=="object"||!s(item.key)){rejected.push({item,reason:"invalid_creator_truth_item"});continue;}if(!isDecision(item)){if(item.current===false)historical.push(item);else active.push(item);continue;}if(item.current===true&&item.authority==="creator"&&item.confidenceSource==="creator-confirmed"&&s(item.decisionId)&&s(item.decisionKey))active.push(item);else if(item.current===false)historical.push(item);else rejected.push({item,reason:"decision_lacks_current_creator_authority"});}return{version:MOVIE_MENTOR_CREATOR_TRUTH_VIEW_VERSION,active,historical,rejected};}
function buildCurrentCreatorTruthView(context=[]){return classifyCreatorTruth(context).active;}
function assertCurrentCreatorTruthOnly(context=[]){const offenders=a(context).filter(item=>isDecision(item)&&item?.current!==true);if(offenders.length){const error=new Error("Superseded or malformed creator decision entered the live creator truth view.");error.code="MOVIE_MENTOR_SUPERSEDED_CREATOR_TRUTH_FORBIDDEN";error.validationIssues=offenders.map(item=>`inactive_creator_decision:${s(item?.decisionId)||s(item?.decisionKey)||s(item?.key)||"unknown"}`);throw error;}return true;}
export{MOVIE_MENTOR_CREATOR_TRUTH_VIEW_VERSION,isDecision,classifyCreatorTruth,buildCurrentCreatorTruthView,assertCurrentCreatorTruthOnly};
export default buildCurrentCreatorTruthView;
