import express from "express";

const VERSION="1.1.0";
function text(value){return typeof value==="string"?value.trim():"";}
function statusFor(code){if(code.includes("CREDENTIAL_REQUIRED")||code.includes("BEARER_REQUIRED")||code.includes("AUTH_EXPIRED")||code.includes("AUTH_REVOKED")||code.includes("TOKEN_VERIFICATION_FAILED"))return 401;if(code.includes("NOT_FOUND"))return 404;if(code.includes("MISMATCH")||code.includes("CONFLICT"))return 409;if(code.includes("NOT_CONFIGURED")||code.includes("UNAVAILABLE"))return 503;if(code.includes("INVALID")||code.includes("REQUIRED")||code.includes("NOT_ELIGIBLE"))return 422;return 502;}
function failure(res,error){const code=text(error?.code)||"MOVIE_MENTOR_COMMERCIAL_REQUEST_FAILED";return res.status(statusFor(code)).json({success:false,code,message:error instanceof Error?error.message:"Movie Mentor commercial request failed."});}

function createMovieMentorCommercialRouter({requestAuthority,purchaseIntentAuthority,checkoutAuthority,listCommercialPackages}={}){
  if(typeof requestAuthority?.authorize!=="function"){const error=new Error("Movie Mentor commercial gateway requires authenticated creator commercial request authority.");error.code="MOVIE_MENTOR_CREATOR_COMMERCIAL_REQUEST_AUTHORITY_REQUIRED";throw error;}
  if(typeof purchaseIntentAuthority?.createPurchaseIntent!=="function"){const error=new Error("Movie Mentor commercial gateway requires durable purchase-intent authority.");error.code="MOVIE_MENTOR_PURCHASE_INTENT_AUTHORITY_REQUIRED";throw error;}
  if(typeof checkoutAuthority?.initiateCheckout!=="function"){const error=new Error("Movie Mentor commercial gateway requires checkout initiation authority.");error.code="MOVIE_MENTOR_CHECKOUT_AUTHORITY_REQUIRED";throw error;}
  if(typeof listCommercialPackages!=="function"){const error=new Error("Movie Mentor commercial gateway requires server-owned package catalogue authority.");error.code="MOVIE_MENTOR_COMMERCIAL_PACKAGE_CATALOGUE_AUTHORITY_REQUIRED";throw error;}

  const router=express.Router();
  router.get("/health",(_req,res)=>res.json({success:true,service:"movie-mentor-commercial-gateway",version:VERSION,authority:{authenticatedPrincipalRequired:true,clientCannotChoosePrincipal:true,clientCannotChoosePrice:true,clientCannotChooseUnits:true,durablePurchaseIntentRequired:true,checkoutRequiresOwnedIntent:true,packageCatalogueServerOwned:true}}));
  router.get("/packages",async(req,res)=>{try{await requestAuthority.authorize({request:req});const packages=await listCommercialPackages();if(!Array.isArray(packages)){const error=new Error("Movie Mentor commercial package catalogue is unavailable.");error.code="MOVIE_MENTOR_COMMERCIAL_PACKAGE_CATALOGUE_UNAVAILABLE";throw error;}return res.json({success:true,status:"commercial-packages-authorized",packages});}catch(error){return failure(res,error);}});
  router.post("/purchase-intents",async(req,res)=>{try{const authorized=await requestAuthority.authorize({request:req});const packageId=text(req.body?.packageId);if(!packageId){const error=new Error("A commercial packageId is required.");error.code="MOVIE_MENTOR_PURCHASE_INTENT_REQUEST_INVALID";throw error;}const intent=await purchaseIntentAuthority.createPurchaseIntent({principalId:authorized.principalId,packageId});return res.status(201).json({success:true,status:"purchase-intent-created",intent});}catch(error){return failure(res,error);}});
  router.post("/checkout",async(req,res)=>{try{const authorized=await requestAuthority.authorize({request:req});const commercialIntentId=text(req.body?.commercialIntentId);if(!commercialIntentId){const error=new Error("A durable commercialIntentId is required.");error.code="MOVIE_MENTOR_CHECKOUT_REQUEST_INVALID";throw error;}const checkout=await checkoutAuthority.initiateCheckout({principalId:authorized.principalId,commercialIntentId});return res.json({success:true,status:"checkout-authorized",checkout});}catch(error){return failure(res,error);}});
  return router;
}

export{VERSION as MOVIE_MENTOR_COMMERCIAL_GATEWAY_VERSION,createMovieMentorCommercialRouter};
export default createMovieMentorCommercialRouter;
