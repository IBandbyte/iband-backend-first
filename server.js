import express from "express";
import cors from "cors";

import artistsRouter from "./artists.js";
import votesRouter from "./votes.js";
import commentsRouter from "./comments.js";

import monetisationRouter from "./monetisation.js";
import sharesRouter from "./shares.js";
import trendsRouter from "./trends.js";

import ambassadorsRouter from "./ambassadors.js";
import moderationRouter from "./moderation.js";

import roomsRouter from "./rooms.js";
import fansRouter from "./fans.js";

import genresRouter from "./genres.js";
import countriesRouter from "./countries.js";

import discoveryRouter from "./discovery.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "25kb" }));

/* ---------- ROOT ---------- */

app.get("/", (req, res) => {
  res.json({
    service: "iBand Backend",
    status: "running",
    version: "H8",
    ts: new Date().toISOString()
  });
});

/* ---------- CORE ---------- */

app.use("/api/artists", artistsRouter);
app.use("/api/votes", votesRouter);
app.use("/api/comments", commentsRouter);

/* ---------- MONETISATION ---------- */

app.use("/api/monetisation", monetisationRouter);

/* ---------- SHARES / TRENDS ---------- */

app.use("/api/shares", sharesRouter);
app.use("/api/trends", trendsRouter);

/* ---------- AMBASSADORS ---------- */

app.use("/api/ambassadors", ambassadorsRouter);

/* ---------- MODERATION ---------- */

app.use("/api/moderation", moderationRouter);

/* ---------- ROOMS ---------- */

app.use("/api/rooms", roomsRouter);

/* ---------- FAN PROFILES ---------- */

app.use("/api/fans", fansRouter);

/* ---------- GENRES ---------- */

app.use("/api/genres", genresRouter);

/* ---------- COUNTRIES ---------- */

app.use("/api/countries", countriesRouter);

/* ---------- GLOBAL DISCOVERY ---------- */

app.use("/api/discovery", discoveryRouter);

/* ---------- START SERVER ---------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`iBand backend running on port ${PORT}`);
});