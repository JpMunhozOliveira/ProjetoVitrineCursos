const express = require("express");
const { listPublicProducts, getPublicProduct } = require("../controllers/product.controller");

// API pública do catálogo (a página de vendas em si é servida pronta em /p/:slug).
const router = express.Router();

router.get("/", listPublicProducts);
router.get("/:slug", getPublicProduct);

module.exports = router;
