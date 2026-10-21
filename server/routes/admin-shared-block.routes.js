const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const {
  listSharedBlocks, createSharedBlock, updateSharedBlock, deleteSharedBlock,
} = require("../controllers/shared-block.controller");

const router = express.Router();

router.use(adminAuth);
router.get("/", listSharedBlocks);
router.post("/", createSharedBlock);
router.put("/:id", updateSharedBlock);
router.delete("/:id", deleteSharedBlock);

module.exports = router;
