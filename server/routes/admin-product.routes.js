const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const {
  listAdminProducts,
  getAdminProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/product.controller");

const { getAdminSalesPage, saveAdminSalesPage } = require("../controllers/sales-page.controller");

const router = express.Router();

router.use(adminAuth);
router.get("/", listAdminProducts);
router.get("/:id", getAdminProduct);
router.post("/", createProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);
router.get("/:id/sales-page", getAdminSalesPage);
router.put("/:id/sales-page", saveAdminSalesPage);

module.exports = router;
