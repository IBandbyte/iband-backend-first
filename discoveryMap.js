import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H40 Global Discovery Map Engine
|--------------------------------------------------------------------------
| Creates map-ready discovery objects for hotspots, radar nodes,
| breakout countries, shockwaves, and live discovery markers.
|--------------------------------------------------------------------------
*/

const MAP_NODES = [
  {
    id: "map_001",
    country: "Nigeria",
    code: "NG",
    lat: 9.082,
    lng: 8.6753,
    type: "breakout_hotspot",
    intensity: "extreme",
    momentumScore: 90,
    icon: "💥",
    color: "gold",
    source: "global-momentum",
    label: "Breakout hotspot",
    message: "Nigeria is generating a major breakout signal."
  },
  {
    id: "map_002",
    country: "Brazil",
    code: "BR",
    lat: -14.235,
    lng: -51.9253,
    type: "shockwave_node",
    intensity: "high",
    momentumScore: 88,
    icon: "🌊",
    color: "red",
    source: "shockwaves",
    label: "Shockwave active",
    message: "A discovery shockwave is expanding across Brazil."
  },
  {
    id: "map_003",
    country: "Japan",
    code: "JP",
    lat: 36.2048,
    lng: 138.2529,
    type: "radar_node",
    intensity: "medium",
    momentumScore: 64,
    icon: "📡",
    color: "magenta",
    source: "global-radar",
    label: "Radar signal",
    message: "Regional radar activity is building in Japan."
  },
  {
    id: "map_004",
    country: "Greece",
    code: "GR",
    lat: 39.0742,
    lng: 21.8243,
    type: "hidden_gem_node",
    intensity: "medium",
    momentumScore: 64,
    icon: "💎",
    color: "emerald",
    source: "hidden-gems",
    label: "Hidden gem growth",
    message: "Hidden gem discovery activity is rising in Greece."
  },
  {
    id: "map_005",
    country: "Argentina",
    code: "AR",
    lat: -38.4161,
    lng: -63.6167,
    type: "viral_stream_node",
    intensity: "high",
    momentumScore: 82,
    icon: "🚀",
    color: "orange",
    source: "viral-stream",
    label: "Viral stream active",
    message: "Argentina is active in the live viral stream."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getHotspots() {
  return MAP_NODES.filter(
    (node) => node.intensity === "extreme" || node.intensity === "high"
  );
}

function getRandomNode() {
  const index = Math.floor(Math.random() * MAP_NODES.length);
  return {
    ...MAP_NODES[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/discovery-map
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H40 Global Discovery Map Engine live.",
    count: MAP_NODES.length,
    routes: [
      "/api/discovery-map",
      "/api/discovery-map/list",
      "/api/discovery-map/hotspots",
      "/api/discovery-map/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/discovery-map/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: MAP_NODES.length,
    nodes: MAP_NODES
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/discovery-map/hotspots
|--------------------------------------------------------------------------
*/

router.get("/hotspots", (req, res) => {
  const hotspots = getHotspots();

  return res.json({
    success: true,
    count: hotspots.length,
    nodes: hotspots
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/discovery-map/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const node = getRandomNode();

  return res.json({
    success: true,
    node
  });
});

export default router;