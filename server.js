import express from "express";

import artists from "./artists.js";
import votes from "./votes.js";
import ranking from "./ranking.js";
import medals from "./medals.js";
import recs from "./recs.js";
import flashMedals from "./flashMedals.js";
import achievements from "./achievements.js";
import purchases from "./purchases.js";
import monetisationSignals from "./monetisationSignals.js";
import shares from "./shares.js";
import trends from "./trends.js";
import ambassadors from "./ambassadors.js";
import moderation from "./moderation.js";
import rooms from "./rooms.js";
import fanProfiles from "./fanProfiles.js";
import genres from "./genres.js";
import countries from "./countries.js";
import discovery from "./discovery.js";
import worldMap from "./world-map.js";
import breakouts from "./breakouts.js";
import crossBorder from "./cross-border.js";
import crossBorderMomentum from "./cross-border-momentum.js";
import fanImpact from "./fan-impact.js";
import fanPower from "./fan-power.js";
import trendStarter from "./trend-starter.js";
import momentumCharts from "./momentum-charts.js";
import surgeDetector from "./surge-detector.js";
import discoveryBoost from "./discovery-boost.js";
import risingNow from "./rising-now.js";
import countryEngine from "./countryEngine.js";
import mapActivity from "./mapActivity.js";
import signalWeight from "./signalWeight.js";
import explosion from "./explosion.js";
import mapIntelligence from "./mapIntelligence.js";
import radar from "./radar.js";
import mapFeed from "./mapFeed.js";
import alerts from "./alerts.js";
import liveHeat from "./liveHeat.js";
import spin from "./spin.js";
import warpDrive from "./warpDrive.js";

const app = express();

app.use(express.json());

/*
|--------------------------------------------------------------------------
| Core Platform
|--------------------------------------------------------------------------
*/

app.use("/api/artists", artists);
app.use("/api/votes", votes);
app.use("/api/ranking", ranking);
app.use("/api/medals", medals);
app.use("/api/recs", recs);
app.use("/api/flash-medals", flashMedals);
app.use("/api/achievements", achievements);
app.use("/api/purchases", purchases);
app.use("/api/monetisation", monetisationSignals);
app.use("/api/shares", shares);
app.use("/api/trends", trends);

/*
|--------------------------------------------------------------------------
| Community Layer
|--------------------------------------------------------------------------
*/

app.use("/api/ambassadors", ambassadors);
app.use("/api/moderation", moderation);
app.use("/api/rooms", rooms);
app.use("/api/fans", fanProfiles);

/*
|--------------------------------------------------------------------------
| Discovery Layer
|--------------------------------------------------------------------------
*/

app.use("/api/genres", genres);
app.use("/api/countries", countries);
app.use("/api/discovery", discovery);
app.use("/api/world-map", worldMap);

/*
|--------------------------------------------------------------------------
| Momentum / Viral Systems
|--------------------------------------------------------------------------
*/

app.use("/api/breakouts", breakouts);
app.use("/api/cross-border", crossBorder);
app.use("/api/cross-border-momentum", crossBorderMomentum);
app.use("/api/fan-impact", fanImpact);
app.use("/api/fan-power", fanPower);
app.use("/api/trend-starter", trendStarter);
app.use("/api/momentum-charts", momentumCharts);
app.use("/api/surge", surgeDetector);
app.use("/api/discovery-boost", discoveryBoost);
app.use("/api/rising-now", risingNow);
app.use("/api/country-engine", countryEngine);
app.use("/api/map-activity", mapActivity);
app.use("/api/signal-weight", signalWeight);
app.use("/api/explosion", explosion);

/*
|--------------------------------------------------------------------------
| Map Intelligence Systems
|--------------------------------------------------------------------------
*/

app.use("/api/map-intelligence", mapIntelligence);
app.use("/api/radar", radar);
app.use("/api/map-feed", mapFeed);

/*
|--------------------------------------------------------------------------
| Alert & Live Systems
|--------------------------------------------------------------------------
*/

app.use("/api/alerts", alerts);
app.use("/api/live-heat", liveHeat);

/*
|--------------------------------------------------------------------------
| Discovery Adventure Systems
|--------------------------------------------------------------------------
*/

app.use("/api/spin", spin);

/*
|--------------------------------------------------------------------------
| H21 Warp Drive Discovery Engine
|--------------------------------------------------------------------------
*/

app.use("/api/warp-drive", warpDrive);

/*
|--------------------------------------------------------------------------
| Root Health Check
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {

return res.json({

success: true,
message: "iBand Backend Online",
version: "H21 Warp Drive Discovery Engine",
systems: [
"world map",
"radar",
"live heat",
"spin globe",
"warp drive",
"breakout detection"
]

});

});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

console.log(`[boot] iband-backend-first listening on port ${PORT}`);

});