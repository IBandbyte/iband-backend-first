const STRUCTURED_AI_PROVIDER_CLIENT_VERSION = "1.0.0";

function cleanString(value){return typeof value === "string" ? value.trim() : "";}
function asArray(value){return Array.isArray(value) ? value : [];}

function getStructuredAIProviderConfig(){
  const provider = cleanString(process.env.IBAND_AI_PROVIDER || "openai").toLowerCase();
  const model = cleanString(process.env.IBAND_AI_MODEL);
  const timeoutMs = Math.max(1000, Number(process.env.IBAND_AI_TIMEOUT_MS || 30000) || 30000);
  if(provider === "openai") return {provider,model,url:cleanString(process.env.IBAND_AI_BASE_URL)||"https://api.openai.com/v1/responses",key:cleanString(process.env.IBAND_AI_API_KEY||process.env.OPENAI_API_KEY),requiresKey:true,requiresModel:true,timeoutMs};
  if(provider === "generic-http") return {provider,model,url:cleanString(process.env.IBAND_AI_BASE_URL),key:cleanString(process.env.IBAND_AI_API_KEY),requiresKey:false,requiresModel:false,timeoutMs};
  return {provider,model,url:"",key:"",requiresKey:false,requiresModel:false,timeoutMs};
}

function getStructuredAIProviderConfigurationIssues(config){
  const issues=[];
  if(!["openai","generic-http"].includes(config?.provider)) issues.push("unsupported_provider");
  if(!config?.url) issues.push("missing_base_url");
  if(config?.requiresKey && !config?.key) issues.push("missing_api_key");
  if(config?.requiresModel && !config?.model) issues.push("missing_model");
  return issues;
}

function classifyStructuredAIProviderFailure(error){
  if(error?.name === "AbortError") return {code:"AI_PROVIDER_TIMEOUT",category:"timeout",retryable:true};
  const status=Number(error?.status||0);
  const providerCode=cleanString(error?.data?.error?.code||error?.data?.code).toLowerCase();
  const message=cleanString(error?.message).toLowerCase();
  const evidence=`${providerCode} ${message}`;
  if(status===401||status===403||/api.?key|auth|credential|permission/.test(evidence)) return {code:"AI_PROVIDER_AUTHENTICATION_FAILED",category:"authentication",retryable:false};
  if(status===404||/model.*(not found|does not exist|invalid)|invalid.*model/.test(evidence)) return {code:"AI_PROVIDER_INVALID_MODEL",category:"invalid-model",retryable:false};
  if(status===429) return {code:"AI_PROVIDER_RATE_LIMITED",category:"rate-limit",retryable:true};
  if(status>=500) return {code:"AI_PROVIDER_UNAVAILABLE",category:"unavailable",retryable:true};
  if(status>=400) return {code:"AI_PROVIDER_REQUEST_REJECTED",category:"request",retryable:false};
  return {code:"AI_PROVIDER_FAILED",category:"unknown",retryable:true};
}

async function postJson(url, body, {key,timeoutMs,headers={}}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs||30000);
  try{
    const response=await fetch(url,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json",...(key?{Authorization:`Bearer ${key}`}:{ }),...headers},body:JSON.stringify(body),signal:controller.signal});
    const text=await response.text();
    let payload=null;
    try{payload=text?JSON.parse(text):null;}catch{payload={raw:text};}
    if(!response.ok){const error=new Error(cleanString(payload?.error?.message)||cleanString(payload?.message)||`AI provider failed (${response.status}).`);error.status=response.status;error.data=payload;throw error;}
    return payload;
  } finally { clearTimeout(timer); }
}

function extractOpenAIOutputText(payload){
  if(cleanString(payload?.output_text)) return payload.output_text;
  for(const item of asArray(payload?.output)) for(const content of asArray(item?.content)) if(cleanString(content?.text)) return content.text;
  return "";
}

function parseJsonText(value){const text=cleanString(value);if(!text)return null;try{return JSON.parse(text);}catch{return null;}}

async function executeStructuredAI({task,systemInstructions,input,schema,schemaName="iband_structured_output",metadata={}}={}){
  const config=getStructuredAIProviderConfig();
  const configurationIssues=getStructuredAIProviderConfigurationIssues(config);
  if(configurationIssues.length){const error=new Error("iBand AI provider is not configured.");error.code="AI_PROVIDER_NOT_CONFIGURED";error.configurationIssues=configurationIssues;throw error;}
  try{
    if(config.provider === "openai"){
      const payload=await postJson(config.url,{model:config.model,instructions:systemInstructions,input:JSON.stringify(input||{}),text:{format:{type:"json_schema",name:schemaName,strict:true,schema}}},config);
      return {structured:parseJsonText(extractOpenAIOutputText(payload)),usage:payload?.usage||null,metadata:{provider:"openai",model:payload?.model||config.model,responseId:payload?.id||null,task,clientVersion:STRUCTURED_AI_PROVIDER_CLIENT_VERSION,...metadata}};
    }
    const payload=await postJson(config.url,{task,systemInstructions,input,schema,schemaName,metadata},config);
    return {structured:payload?.structured||payload?.data||parseJsonText(payload?.text),usage:payload?.usage||null,metadata:{provider:"generic-http",model:payload?.model||config.model||null,responseId:payload?.id||null,task,clientVersion:STRUCTURED_AI_PROVIDER_CLIENT_VERSION,...metadata}};
  } catch(error){
    if(error?.code) throw error;
    const classification=classifyStructuredAIProviderFailure(error);
    error.code=classification.code;error.providerFailureCategory=classification.category;error.retryable=classification.retryable;throw error;
  }
}

export {STRUCTURED_AI_PROVIDER_CLIENT_VERSION,getStructuredAIProviderConfig,getStructuredAIProviderConfigurationIssues,classifyStructuredAIProviderFailure,executeStructuredAI};
export default executeStructuredAI;
