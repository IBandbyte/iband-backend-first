// Single-flight, bounded creator gateway recovery. This module never bypasses
// mount readiness: the injected mount function owns all strict safety checks.
function registerMovieMentorCreatorGatewayRecovery({
 mount,
 prepare,
 initialMount,
 delayMs=5000,
 maxAttempts=12,
 schedule=setTimeout,
 cancel=clearTimeout,
 onResult=()=>{}
}={}){
 if(typeof mount!=="function"||typeof prepare!=="function")throw new TypeError("Creator gateway recovery requires mount and prepare functions.");
 if(!Number.isSafeInteger(maxAttempts)||maxAttempts<1||!Number.isSafeInteger(delayMs)||delayMs<1)throw new TypeError("Invalid bounded creator gateway recovery policy.");
 let mounted=initialMount?.mounted===true;
 let stopped=false;
 let running=false;
 let timer=null;
 let attempts=0;
 const scheduleNext=()=>{
  if(stopped||mounted||running||timer!==null||attempts>=maxAttempts)return;
  timer=schedule(()=>{timer=null;void retry();},delayMs);
 };
 const report=outcome=>{try{onResult(outcome);}catch{/* Observability must never alter gateway safety or retry lifecycle. */}};
 const retry=async()=>{
  if(stopped||mounted||running||attempts>=maxAttempts)return;
  running=true;
  attempts++;
  try{
   const preparation=await prepare();
   if(stopped)return;
   if(preparation?.ready!==true){
    report(Object.freeze({mounted:false,reason:preparation?.reason||"canonical-creator-state-mongo-not-ready",attempts}));
    return;
   }
   const outcome=await mount();
   if(stopped)return;
   if(outcome?.mounted===true)mounted=true;
   report(Object.freeze({mounted,reason:outcome?.reason||"creator-gateway-recovery-attempt",attempts}));
  }catch(error){
   if(!stopped)report(Object.freeze({mounted:false,reason:error?.code||"creator-gateway-recovery-attempt-failed",attempts}));
  }finally{
   running=false;
   scheduleNext();
  }
 };
 if(!mounted)scheduleNext();
 return Object.freeze({
  stop(){stopped=true;if(timer!==null){cancel(timer);timer=null;}},
  getStatus(){return Object.freeze({mounted,stopped,running,attempts,pending:timer!==null,exhausted:attempts>=maxAttempts&&!mounted});}
 });
}
export{registerMovieMentorCreatorGatewayRecovery};
