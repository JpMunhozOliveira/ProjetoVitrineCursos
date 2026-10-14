const express = require("express");
const { listPublicProducts, getPublicProduct } = require("../controllers/product.controller");

const { getPublicSalesPage } = require("../controllers/sales-page.controller");

const router = express.Router();

router.get("/", listPublicProducts);
router.get("/:slug", getPublicProduct);
router.get("/:slug/sales-page", getPublicSalesPage);

module.exports = router;
