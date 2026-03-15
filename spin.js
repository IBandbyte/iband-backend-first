import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H19 Spin The Globe Discovery Engine
|--------------------------------------------------------------------------
| Purpose
| - allow users to spin the globe and discover random countries
| - return discovery cards for that country
| - support genre exploration later
|--------------------------------------------------------------------------
*/

const COUNTRIES = [
{ code: "BR", name: "Brazil", flag: "🇧🇷", genres: ["Funk Carioca","Sertanejo","Brazilian Pop"] },
{ code: "US", name: "United States", flag: "🇺🇸", genres: ["Hip Hop","Pop","Country"] },
{ code: "UK", name: "United Kingdom", flag: "🇬🇧", genres: ["Grime","UK Rap","Electronic"] },
{ code: "KR", name: "South Korea", flag: "🇰🇷", genres: ["K-Pop","K-HipHop","K-Indie"] },
{ code: "NG", name: "Nigeria", flag: "🇳🇬", genres: ["Afrobeats","Afropop","Highlife"] },
{ code: "ES", name: "Spain", flag: "🇪🇸", genres: ["Latin Pop","Flamenco","Reggaeton"] },
{ code: "MX", name: "Mexico", flag: "🇲🇽", genres: ["Regional Mexican","Latin Pop","Corridos"] },
{ code: "JP", name: "Japan", flag: "🇯🇵", genres: ["J-Pop","City Pop","Anime Music"] },
{ code: "DE", name: "Germany", flag: "🇩🇪", genres: ["Techno","Electronic","German Rap"] },
{ code: "AR", name: "Argentina", flag: "🇦🇷", genres: ["Trap Latino","Cumbia","Latin Pop"] },
{ code: "FR", name: "France", flag: "🇫🇷", genres: ["French Rap","Afro Pop","Electronic"] },
{ code: "IN", name: "India", flag: "🇮🇳", genres: ["Bollywood","Punjabi","Indian Pop"] },
{ code: "IT", name: "Italy", flag: "🇮🇹", genres: ["Italian Pop","Rap Italiano","Dance"] },
{ code: "ZA", name: "South Africa", flag: "🇿🇦", genres: ["Amapiano","Afrobeats","House"] }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function randomCountry() {
return COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
}

function buildDiscoveryCard(country) {

return {

countryCode: country.code,

countryName: country.name,

flag: country.flag,

discoveryCard: {

headline: `🌍 You landed on ${country.name} ${country.flag}`,

subline: "Discover music and artists from this country",

genres: country.genres

},

actions: [

"explore_country",

"spin_again",

"genre_adventure"

]

};

}

/*
|--------------------------------------------------------------------------
| GET /api/spin
|--------------------------------------------------------------------------
*/

router.get("/", (req,res)=>{

return res.json({

success:true,

message:"H19 Spin The Globe Discovery Engine live.",

countriesAvailable: COUNTRIES.length,

routes:[
"/api/spin",
"/api/spin/random",
"/api/spin/country/:code",
"/api/spin/genres/:country"
]

});

});

/*
|--------------------------------------------------------------------------
| GET /api/spin/random
|--------------------------------------------------------------------------
*/

router.get("/random",(req,res)=>{

const country=randomCountry();

return res.json({

success:true,

spinResult: buildDiscoveryCard(country)

});

});

/*
|--------------------------------------------------------------------------
| GET /api/spin/country/:code
|--------------------------------------------------------------------------
*/

router.get("/country/:code",(req,res)=>{

const code=req.params.code.toUpperCase();

const country=COUNTRIES.find(c=>c.code===code);

if(!country){

return res.status(404).json({

success:false,

message:"Country not found"

});

}

return res.json({

success:true,

spinResult: buildDiscoveryCard(country)

});

});

/*
|--------------------------------------------------------------------------
| GET /api/spin/genres/:country
|--------------------------------------------------------------------------
*/

router.get("/genres/:country",(req,res)=>{

const code=req.params.country.toUpperCase();

const country=COUNTRIES.find(c=>c.code===code);

if(!country){

return res.status(404).json({

success:false,

message:"Country not found"

});

}

return res.json({

success:true,

country: country.name,

genres: country.genres

});

});

export default router;