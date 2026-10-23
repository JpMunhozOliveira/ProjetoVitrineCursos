const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const {
  listSharedBlocks, getSharedBlock, previewSharedBlock, createSharedBlock, updateSharedBlock, deleteSharedBlock,
} = require("../controllers/shared-block.controller");

const router = express.Router();

router.use(adminAuth);
router.get("/", listSharedBlocks);
router.get("/:id", getSharedBlock);
router.post("/", createSharedBlock);
router.post("/:id/preview", previewSharedBlock);
router.put("/:id", updateSharedBlock);
router.delete("/:id", deleteSharedBlock);

module.exports = router;
