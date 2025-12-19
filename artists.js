/**
 * iBand Backend — Artists Routes
 * Root-level file (per Captain’s Protocol)
 *
 * Endpoints:
 * - GET    /artists
 * - GET    /artists/:id
 * - POST   /artists
 * - PUT    /artists/:id
 * - PATCH  /artists/:id
 * - DELETE /artists/:id
 *
 * Extra (future-proof helpers):
 * - POST   /artists/:id/votes      (increment votes)
 * - GET    /artists/meta/genres    (list known genres)
 */

import express from "express";
import {
  listArtists,
  createArtist,
  getArtistById,
  updateArtist,
  deleteArtist,
  incrementArtistVotes,
  toPublicArtist,
} from "./models/artist.model.js";

const router = express.Router();

/** ---------------- Helpers ---------------- */

function sendOk(res, data, status = 200) {
  return res.status(status).json(data);
}

function sendError(res, err) {
  const status = Number(err?.status) || 500;

  const payload = {
    error: err?.message || "Server error",
    code: err?.code || (status === 500 ? "SERVER_ERROR" : "ERROR"),
  };

  if (err?.fields && typeof err.fields === "object") {
    payload.fields = err.fields;
  }

  return res.status(status).json(payload);
}

/**
 * Very lightweight query parsing for iPhone Hoppscotch reliability
 */
function parseListQuery(q) {
  return {
    q: q?.q,
    genre: q?.genre,
    status: q?.status, // active|pending|hidden|all
    sort: q?.sort, // new|votes|name
    order: q?.order, // asc|desc
    page: q?.page,
    limit: q?.limit,
  };
}

/** ---------------- Routes ---------------- */

/**
 * GET /artists
 * Query:
 *  - q, genre, status, sort, order, page, limit
 * Returns:
 *  { page, limit, total, items: [...] }
 */
router.get("/", (req, res) => {
  try {
    const result = listArtists(parseListQuery(req.query));
    const items = result.items.map(toPublicArtist);
    return sendOk(res, { ...result, items });
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * GET /artists/meta/genres
 * Returns unique genres currently in store
 */
router.get("/meta/genres", (req, res) => {
  try {
    const result = listArtists({ status: "all", limit: 50, page: 1 });
    const all = [];
    for (const a of result.items) {
      for (const g of a.genres || []) all.push(String(g || "").trim());
    }
    const unique = Array.from(new Set(all.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    return sendOk(res, { items: unique });
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * GET /artists/:id
 */
router.get("/:id", (req, res) => {
  try {
    const artist = getArtistById(req.params.id);
    return sendOk(res, toPublicArtist(artist));
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * POST /artists
 * Body:
 *  { name, genres?, location?, bio?, avatarUrl?, socials?, tracks?, status? }
 */
router.post("/", (req, res) => {
  try {
    const created = createArtist(req.body);
    return sendOk(res, toPublicArtist(created), 201);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * PUT /artists/:id
 * Full update (but we still allow partial values safely)
 */
router.put("/:id", (req, res) => {
  try {
    const updated = updateArtist(req.params.id, req.body);
    return sendOk(res, toPublicArtist(updated));
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * PATCH /artists/:id
 * Partial update
 */
router.patch("/:id", (req, res) => {
  try {
    const updated = updateArtist(req.params.id, req.body);
    return sendOk(res, toPublicArtist(updated));
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * DELETE /artists/:id
 */
router.delete("/:id", (req, res) => {
  try {
    const result = deleteArtist(req.params.id);
    return sendOk(res, result);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * POST /artists/:id/votes
 * Body (optional):
 *  { amount: number }  // default 1
 * Returns updated artist
 */
router.post("/:id/votes", (req, res) => {
  try {
    const amount = req.body?.amount ?? 1;
    const updated = incrementArtistVotes(req.params.id, amount);
    return sendOk(res, toPublicArtist(updated));
  } catch (err) {
    return sendError(res, err);
  }
});

export default router;