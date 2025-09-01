// admin.js — iBand backend routes for admin

const express = require("express");
const router = express.Router();

// --- Test route (so /admin works in browser) ---
router.get("/", (req, res) => {
  res.json({ status: "ok", message: "Admin route is working" });
});

// --- Example: Admin login route ---
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // 🔒 Replace this with real admin check later
  if (username === "admin" && password === process.env.ADMIN_SECRET) {
    res.json({ success: true, message: "✅ Logged in as admin" });
  } else {
    res.status(401).json({ success: false, message: "❌ Invalid credentials" });
  }
});

module.exports = router;