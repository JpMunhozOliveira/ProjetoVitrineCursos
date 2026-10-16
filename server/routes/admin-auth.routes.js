const express = require("express");
const requireAdmin = require("../middleware/admin-auth");
const { login, me, logout } = require("../controllers/auth.controller");

const router = express.Router();
router.post("/login", login);
router.get("/me", requireAdmin, me);
router.post("/logout", requireAdmin, logout);

module.exports = router;
