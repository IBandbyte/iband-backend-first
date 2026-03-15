import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H20 Discovery Adventure Engine (Upgraded)
|--------------------------------------------------------------------------
| Features
| - Music Passport
| - Multi-instrument country collection
| - Progressive unlocks
| - Explorer ranks
| - Country completion tracking
|--------------------------------------------------------------------------
*/

const COUNTRY_ADVENTURES = [

{
code:"GR",
country:"Greece",
flag:"🇬🇷",
instruments:[
{ name:"Bouzouki", icon:"🎸" },
{ name:"Lyra", icon:"🎻" },
{ name:"Baglama", icon:"🎶" },
{ name:"Laouto", icon:"🎸" }
]
},

{
code:"JP",
country:"Japan",
flag:"🇯🇵",
instruments:[
{ name:"Shamisen", icon:"🎻" },
{ name:"Taiko Drum", icon:"🥁" },
{ name:"Koto", icon:"🎶" },
{ name:"Shakuhachi Flute", icon:"🎼" }
]
},

{
code:"IN",
country:"India",
flag:"🇮🇳",
instruments:[
{ name:"Sitar", icon:"🎶" },
{ name:"Tabla", icon:"🥁" },
{ name:"Sarod", icon:"🎸" },
{ name:"Bansuri Flute", icon:"🎼" }
]
},

{
code:"BR",
country:"Brazil",
flag:"🇧🇷",
instruments:[
{ name:"Samba Drum", icon:"🥁" },
{ name:"Berimbau", icon:"🎻" },
{ name:"Pandeiro", icon:"🥁" },
{ name:"Cavaquinho", icon:"🎸" }
]
},

{
code:"ES",
country:"Spain",
flag:"🇪🇸",
instruments:[
{ name:"Flamenco Guitar", icon:"🎸" },
{ name:"Castanets", icon:"🎶" },
{ name:"Cajón", icon:"🥁" },
{ name:"Bandurria", icon:"🎻" }
]
},

{
code:"NG",
country:"Nigeria",
flag:"🇳🇬",
instruments:[
{ name:"Talking Drum", icon:"🥁" },
{ name:"Udu Drum", icon:"🥁" },
{ name:"Shekere", icon:"🎶" },
{ name:"Ogene Bell", icon:"🔔" }
]
},

{
code:"AR",
country:"Argentina",
flag:"🇦🇷",
instruments:[
{ name:"Bandoneón", icon:"🎹" },
{ name:"Bombo Drum", icon:"🥁" },
{ name:"Charango", icon:"🎸" },
{ name:"Quena Flute", icon:"🎼" }
]
},

{
code:"IE",
country:"Ireland",
flag:"🇮🇪",
instruments:[
{ name:"Celtic Harp", icon:"🎼" },
{ name:"Tin Whistle", icon:"🎶" },
{ name:"Bodhrán Drum", icon:"🥁" },
{ name:"Uilleann Pipes", icon:"🎵" }
]
}

];

/*
|--------------------------------------------------------------------------
| Explorer Rank System
|--------------------------------------------------------------------------
*/

function getExplorerRank(countryCount){

if(countryCount >= 50) return "World Music Master";
if(countryCount >= 25) return "Global Nomad";
if(countryCount >= 10) return "Music Explorer";
if(countryCount >= 3) return "Music Tourist";

return "New Listener";

}

/*
|--------------------------------------------------------------------------
| Simulated Passport (Demo Version)
|--------------------------------------------------------------------------
| Later this will come from user database
|--------------------------------------------------------------------------
*/

function buildPassport(){

const passport = COUNTRY_ADVENTURES.map(country=>{

return{

country:country.country,

flag:country.flag,

instruments:country.instruments

};

});

const countryCount = passport.length;

return{

visitedCountries:countryCount,

instrumentsCollected:passport.reduce(
(total,c)=>total+c.instruments.length,0
),

explorerRank:getExplorerRank(countryCount),

passport

};

}

/*
|--------------------------------------------------------------------------
| Unlock Instrument Logic
|--------------------------------------------------------------------------
*/

function getNextInstrument(countryCode, visitCount){

const country = COUNTRY_ADVENTURES.find(c=>c.code===countryCode);

if(!country) return null;

const index = Math.min(visitCount-1, country.instruments.length-1);

return country.instruments[index];

}

/*
|--------------------------------------------------------------------------
| GET /api/adventure
|--------------------------------------------------------------------------
*/

router.get("/",(req,res)=>{

return res.json({

success:true,

message:"H20 Discovery Adventure Engine live.",

features:[
"Music Passport",
"Instrument Collection",
"Explorer Ranks",
"Country Completion"
],

routes:[
"/api/adventure",
"/api/adventure/passport",
"/api/adventure/country/:code",
"/api/adventure/unlock/:code/:visit"
]

});

});

/*
|--------------------------------------------------------------------------
| GET /api/adventure/passport
|--------------------------------------------------------------------------
*/

router.get("/passport",(req,res)=>{

return res.json({

success:true,

passport:buildPassport()

});

});

/*
|--------------------------------------------------------------------------
| GET /api/adventure/country/:code
|--------------------------------------------------------------------------
*/

router.get("/country/:code",(req,res)=>{

const code=req.params.code.toUpperCase();

const country=COUNTRY_ADVENTURES.find(c=>c.code===code);

if(!country){

return res.status(404).json({
success:false,
message:"Country not found"
});

}

return res.json({

success:true,

country:country.country,

flag:country.flag,

instrumentCollection:country.instruments,

collectionSize:country.instruments.length

});

});

/*
|--------------------------------------------------------------------------
| GET /api/adventure/unlock/:code/:visit
|--------------------------------------------------------------------------
*/

router.get("/unlock/:code/:visit",(req,res)=>{

const code=req.params.code.toUpperCase();

const visit=parseInt(req.params.visit);

const instrument=getNextInstrument(code,visit);

if(!instrument){

return res.status(404).json({
success:false,
message:"Instrument not found"
});

}

return res.json({

success:true,

visitNumber:visit,

unlockedInstrument:instrument

});

});

export default router;