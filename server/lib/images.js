// Validação e processamento das imagens enviadas.
const sharp = require("sharp");

const MAX_BYTES = 5 * 1024 * 1024;   // 5 MB por envio
const MAX_PIXELS = 40_000_000;       // ~7300 x 5500: barra "bombas de descompressão"
const MAX_SIDE = 1600;               // maior lado depois de redimensionar (suficiente para capa e banner)

// Identifica o tipo pelos primeiros bytes ("assinatura" do formato). Extensão e Content-Type
// são informados pelo cliente e podem ser falsificados; a assinatura vem do próprio arquivo.
function detectType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

// Recodifica para WebP. Recodificar (e não só copiar) tem efeito de segurança: o arquivo final
// contém apenas pixels — metadados (EXIF, localização GPS de fotos de celular) e qualquer
// conteúdo extra escondido no arquivo original são descartados.
async function processImage(buf) {
  const { data, info } = await sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: "error" })
    .rotate() // aplica a orientação do EXIF antes de descartá-lo (foto "deitada" fica em pé)
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, size: info.size };
}

module.exports = { MAX_BYTES, detectType, processImage };
