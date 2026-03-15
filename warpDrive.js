import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H21 Warp Drive Discovery Engine
|--------------------------------------------------------------------------
| Simulates global spread of music across countries
| based on momentum signals.
|--------------------------------------------------------------------------
*/

const WARP_ROUTES = [
["GR","TR","DE","UK","US"],
["BR","ES","FR","UK","US"],
["JP","KR","US"],
["NG","FR","UK","US"],
["AR","ES","IT","FR","UK"]
];

function pickRoute(){
return WARP_ROUTES[Math.floor(Math.random()*WARP_ROUTES.length)];
}

function generateWarpPath(artistId){

const route = pickRoute();

return {
artistId,
path: route,
hops: route.length,
startCountry: route[0],
endCountry: route[route.length-1],
status: route.length >=4 ? "breakout_possible":"regional_spread"
};

}

/*
|--------------------------------------------------------------------------
| GET /api/warp-drive
|--------------------------------------------------------------------------
*/

router.get("/",(req,res)=>{

return res.json({

success:true,

message:"H21 Warp Drive Discovery Engine live.",

routes:[
"/api/warp-drive",
"/api/warp-drive/simulate/:artistId",
"/api/warp-drive/routes"
]

});

});

/*
|--------------------------------------------------------------------------
| GET /api/warp-drive/routes
|--------------------------------------------------------------------------
*/

router.get("/routes",(req,res)=>{

return res.json({

success:true,

totalRoutes:WARP_ROUTES.length,

routes:WARP_ROUTES

});

});

/*
|--------------------------------------------------------------------------
| GET /api/warp-drive/simulate/:artistId
|--------------------------------------------------------------------------
*/

router.get("/simulate/:artistId",(req,res)=>{

const artistId=req.params.artistId;

const warp=generateWarpPath(artistId);

return res.json({

success:true,

warp

});

});

export default router;