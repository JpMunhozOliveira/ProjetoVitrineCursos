const express = require("express");
const { track } = require("../controllers/track.controller");

const router = express.Router();

// navigator.sendBeacon manda o corpo como text/plain; o JSON é lido aqui (no máximo 2 KB).
router.post("/", express.text({ type: ["text/plain", "application/json"], limit: "2kb" }), (req, _res, next) => {
  if (typeof req.body === "string") {
    try { req.body = JSON.parse(req.body); } catch { req.body = null; }
  }
  next();
}, track);

module.exports = router;
