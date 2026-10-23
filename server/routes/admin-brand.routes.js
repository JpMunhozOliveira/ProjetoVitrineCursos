const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const { listBrands, createBrand, updateBrand, deleteBrand } = require("../controllers/brand.controller");
const {
  connectAccount, disconnectAccount, listAccountProducts, getAccountProduct,
} = require("../controllers/kiwify.controller");

const router = express.Router();

router.use(adminAuth);
router.get("/", listBrands);
router.post("/", createBrand);
router.put("/:id", updateBrand);
router.delete("/:id", deleteBrand);
// Conta Kiwify da empresa (preço e link automáticos nos produtos dela).
router.put("/:id/kiwify", connectAccount);
router.delete("/:id/kiwify", disconnectAccount);
router.get("/:id/kiwify/products", listAccountProducts);
router.get("/:id/kiwify/products/:productId", getAccountProduct);

module.exports = router;
