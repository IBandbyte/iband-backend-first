import express from "express";
import {createMovieMentorProductionAuthenticationComposition} from "./MovieMentorProductionAuthenticationComposition.js";
import {createMovieMentorProductionCommercialPolicyComposition} from "./MovieMentorProductionCommercialPolicyComposition.js";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "./MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "./MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionCreatorCommercialComposition} from "./MovieMentorProductionCreatorCommercialComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "./MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "./MovieMentorProductionCommercialProviderIngressComposition.js";
import {createMovieMentorStripeCommercialProviderAdapter} from "./MovieMentorStripeCommercialProviderAdapter.js";

const VERSION="1.2.0";
const CREATOR_BASE_PATH="/api/movie-mentor/commercial";
const STRIPE_WEBHOOK_PATH="/api/movie-mentor/commercial/providers/stripe/webhook";
function text(v){return typeof v==="string"?v.trim():"";}
function closed(reason){return Object.freeze({mounted:false,reason,creatorBasePath:CREATOR_BASE_PATH,stripeWebhookPath:STRIPE_WEBHOOK_PATH,creatorRouter:null});}

async function mountMovieMentorProductionCommercialHttpIngress({app,env=process.env,stripe=null}={}){
 if(!app||typeof app.post!=="function")return closed("express-app-required");
 const authentication=createMovieMentorProductionAuthenticationComposition();
 if(authentication?.ready!==true)return closed(authentication?.reason||"production-authentication-not-ready");
 const policy=createMovieMentorProductionCommercialPolicyComposition({env});
 if(policy?.ready!==true)return closed(policy?.reason||"commercial-policy-not-ready");
 let purchase,checkout,creator,issuance,ingress,adapter;
 try{
  purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:policy.resolveCommercialPolicy});
  issuance=createMovieMentorProductionEntitlementIssuanceComposition();
  if(issuance?.ready!==true)return closed(issuance?.reason||"entitlement-issuance-not-ready");
  const webhookSecret=text(env.MOVIE_MENTOR_STRIPE_WEBHOOK_SECRET),successUrl=text(env.MOVIE_MENTOR_STRIPE_SUCCESS_URL),cancelUrl=text(env.MOVIE_MENTOR_STRIPE_CANCEL_URL);
  if(!stripe||!webhookSecret||!successUrl||!cancelUrl)return closed("stripe-commercial-provider-not-configured");
  adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret,successUrl,cancelUrl});
  checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,providers:{stripe:adapter}});
  creator=createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:purchase.authority,checkoutAuthority:checkout.authority,listCommercialPackages:policy.listCommercialPackages});
  ingress=createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:purchase.authority,issuanceAuthority:issuance.authority,providers:{stripe:adapter}});
 }catch(error){return closed(error?.code||"commercial-http-composition-failed");}

 app.post(STRIPE_WEBHOOK_PATH,express.raw({type:"application/json",limit:"512kb"}),async(req,res)=>{
  try{const result=await ingress.authority.ingest({provider:"stripe",delivery:{rawBody:req.body,signature:req.get("Stripe-Signature")||""}});return res.status(200).json({received:true,status:result?.status||"commercial-evidence-processed"});}
  catch(error){const code=text(error?.code)||"MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_FAILED";const clientFault=code.includes("SIGNATURE")||code.includes("DELIVERY_INVALID")||code.includes("PROVIDER_NOT_CONFIGURED");return res.status(clientFault?400:500).json({received:false,code});}
 });
 return Object.freeze({mounted:true,reason:"commercial-provider-ingress-composed",creatorBasePath:CREATOR_BASE_PATH,stripeWebhookPath:STRIPE_WEBHOOK_PATH,creatorRouter:creator.router,version:VERSION});
}

export{VERSION as MOVIE_MENTOR_PRODUCTION_COMMERCIAL_HTTP_INGRESS_VERSION,CREATOR_BASE_PATH as MOVIE_MENTOR_CREATOR_COMMERCIAL_BASE_PATH,STRIPE_WEBHOOK_PATH as MOVIE_MENTOR_STRIPE_WEBHOOK_PATH,mountMovieMentorProductionCommercialHttpIngress};
export default mountMovieMentorProductionCommercialHttpIngress;
