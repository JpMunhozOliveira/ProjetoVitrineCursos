const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const { getDashboard, refreshSales } = require("../controllers/dashboard.controller");

const router = express.Router();

router.use(adminAuth);
router.get("/", getDashboard);
router.post("/refresh", refreshSales);

module.exports = router;
