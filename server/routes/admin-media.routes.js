const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const { MAX_BYTES } = require("../lib/images");
const { uploadMedia, listMedia, updateMedia, deleteMedia } = require("../controllers/media.controller");

const router = express.Router();

// O arquivo chega como corpo bruto da requisição (fetch(url, { body: file })), sem multipart.
// Só esses Content-Types são lidos; o tipo real é conferido depois pela assinatura do arquivo.
const rawImage = express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: MAX_BYTES });

router.use(adminAuth);
router.get("/", listMedia);
router.post("/", rawImage, uploadMedia);
router.patch("/:id", updateMedia);
router.delete("/:id", deleteMedia);

module.exports = router;
