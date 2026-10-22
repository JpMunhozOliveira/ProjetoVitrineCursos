const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const { listBrands, createBrand, updateBrand, deleteBrand } = require("../controllers/brand.controller");

const router = express.Router();

router.use(adminAuth);
router.get("/", listBrands);
router.post("/", createBrand);
router.put("/:id", updateBrand);
router.delete("/:id", deleteBrand);

module.exports = router;
