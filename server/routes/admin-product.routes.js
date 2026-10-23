const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const {
  listAdminProducts,
  getAdminProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  syncKiwifyProduct,
  listAreas,
} = require("../controllers/product.controller");

const { getAdminSalesPage, saveAdminSalesPage, publishAdminSalesPage, previewAdminSalesPage } = require("../controllers/sales-page.controller");

const router = express.Router();

router.use(adminAuth);
router.get("/", listAdminProducts);
router.get("/areas", listAreas); // antes de "/:id"
router.get("/:id", getAdminProduct);
router.post("/", createProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);
router.post("/:id/kiwify-sync", syncKiwifyProduct);
router.get("/:id/sales-page", getAdminSalesPage);
router.put("/:id/sales-page", saveAdminSalesPage);
router.post("/:id/sales-page/preview", previewAdminSalesPage);
router.post("/:id/sales-page/publish", publishAdminSalesPage);

module.exports = router;
