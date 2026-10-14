// Importa o conteúdo do Manual (que era a página estática public/curso-reforma-tributaria.html) para o banco:
// cria o produto (se ainda não existir), envia a capa para a biblioteca e monta a página de
// vendas em blocos com os mesmos textos. Pode ser executado mais de uma vez: a página é regravada.
//
//   docker compose exec app node scripts/import-manual.js
//
// O produto é criado como RASCUNHO e a página fica SEM PUBLICAR: revise na pré-visualização
// do painel e publique quando estiver tudo certo.
const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../config/database");
const storage = require("../lib/storage");
const { processImage } = require("../lib/images");
const { savePage } = require("../sales/pages");

const SLUG = "manual-reforma-tributaria";
// Capa original do Manual (fica junto do script: só ele a usa).
const COVER_FILE = path.join(__dirname, "data", "cover-reforma.png");

const PRODUCT = {
  title: "Manual Prático da Reforma Tributária do Consumo",
  slug: SLUG,
  category: "Coleção Manuais Práticos",
  featured: true,
  short_description: "Manual desenvolvido para profissionais que precisam consultar rapidamente IBS, CBS, Split Payment, DF-e, Apuração Assistida e Escrituração do IVA Dual.",
  format: "PDF",
  price_cents: 1990,
  checkout_url: "https://pay.kiwify.com.br/2IDvyM2",
};

const yes = (text) => ({ text, positive: true });
const no = (text) => ({ text, positive: false });

function sections(coverId) {
  return [
    { type: "hero", title: PRODUCT.title, image: coverId,
      lead: "Fique por dentro das regras da nova tributação e entenda o impacto na rotina contábil e fiscal de empresas de todos os portes.",
      badges: [{ strong: "PDF", text: "Prático" }, { strong: "Bônus", text: "Exclusivos" }, { strong: "Acesso", text: "Imediato" }],
      price_label: "Por apenas", cta_label: "Comprar agora" },
    { type: "benefits", title: "Benefícios rápidos", items: [
      { icon: "bolt", title: "100% Direto ao Ponto",
        text: "O que você realmente precisa saber sobre o IBS, a CBS e o Imposto Seletivo sem complicação.",
        callout: "Foco total na aplicação prática para o seu dia a dia profissional." },
      { icon: "doc", title: "Atualizado e Didático",
        text: "Estruturado de forma esquematizada para facilitar a consulta rápida de regras e prazos.",
        callout: "Seu guia seguro para a transição tributária." }] },
    { type: "topics", title: "O que você vai encontrar no Manual", items: [
      { icon: "doc", title: "Contexto e Visão Geral", text: "Entenda os pilares e os objetivos centrais da nova reforma." },
      { icon: "calc", title: "IBS e CBS", text: "Como vão funcionar os novos tributos sub-rogados e dual." },
      { icon: "shield", title: "Imposto Seletivo", text: "Conheça a incidência sobre bens prejudiciais à saúde e meio ambiente." },
      { icon: "check", title: "Regras de Crédito", text: "A dinâmica da não cumulatividade plena no novo sistema." },
      { icon: "bolt", title: "Split Payment", text: "O mecanismo de recolhimento automático e suas repercussões." },
      { icon: "doc", title: "Cronograma de Transição", text: "Os prazos oficiais e as fases de implantação ano a ano." },
      { icon: "user", title: "Impactos Setoriais", text: "Análise das mudanças no comércio, indústria e serviços." },
      { icon: "check", title: "Checklist Prático", text: "Orientações passo a passo para a adaptação dos negócios." }] },
    // A página original tinha só espaços reservados no carrossel: envie as imagens pelo painel.
    { type: "gallery", title: "Conheça o Manual por Dentro", images: [] },
    { type: "checklist", icon: "shield", title: "Conteúdo focado no que importa", items: [
      no("Textos longos, cansativos e cheios de juridiquês"), no("Teorias complexas sem aplicação prática"),
      yes("Explicações diretas e simplificadas"), yes("Segurança para orientar clientes e empresas")] },
    { type: "comparison", title: "Diferenciais do Manual",
      left_title: "Método Tradicional",
      left_items: [{ text: "Leitura exaustiva de leis" }, { text: "Falta de exemplos visuais" }, { text: "Difícil de aplicar no dia a dia" }],
      right_title: "Manual Prático",
      right_items: [{ text: "Esquematizado por tópicos" }, { text: "Casos práticos reais" }, { text: "Consulta ágil e objetiva" }] },
    { type: "author", name: "Lucas Coutinho", role: "Especialista em Tributação e Reforma Tributária",
      bio: "Atua na área contábil/tributária e construiu este material prático com o objetivo de traduzir a complexidade da Reforma do Consumo em orientações claras, diretas e aplicáveis para profissionais e empresários que precisam se antecipar às mudanças." },
    { type: "audience", title: "Para quem é este material?", items: [
      { icon: "calc", text: "Contadores" }, { icon: "shield", text: "Advogados" },
      { icon: "user", text: "Empresários" }, { icon: "doc", text: "Estudantes" }] },
    { type: "highlight", title: "Deseja aprofundar ainda mais?",
      text: "Tenha acesso a conteúdos complementares focados em cenários avançados da transição fiscal.",
      items: [{ text: "Análise de impactos por CNAE" }, { text: "Estratégias de planejamento tributário" }, { text: "Atualizações normativas comentadas" }] },
    { type: "faq", title: "Dúvidas mais frequentes", items: [
      { question: "Em que formato recebo o manual?", answer: "O material é disponibilizado em formato digital (PDF), otimizado para leitura em computadores, tablets e smartphones." },
      { question: "Como recebo o acesso ao produto?", answer: "Assim que o pagamento for confirmado, você receberá os dados de acesso diretamente no seu e-mail cadastrado através da plataforma de pagamentos." },
      { question: "O manual será atualizado com as novas leis complementares?", answer: "Sim! O conteúdo acompanha as atualizações normativas da regulamentação da reforma tributária." },
      { question: "Preciso ter conhecimento prévio avançado?", answer: "Não. O material foi desenhado para atender desde profissionais que estão começando até especialistas que buscam uma consulta rápida e esquematizada." },
      { question: "E se eu não gostar do conteúdo?", answer: "Você tem 7 dias de garantia incondicional. Caso sinta que o material não atendeu às suas expectativas, poderá solicitar o reembolso integral dentro do prazo." }] },
    { type: "guarantee", title: "Compra segura e garantida", items: [
      { icon: "shield", text: "Pagamento 100% seguro" }, { icon: "check", text: "7 dias de garantia" }, { icon: "bolt", text: "Acesso imediato" }] },
    { type: "offer", image: coverId, title: `Garanta agora o seu ${PRODUCT.title}`,
      price_label: "Oferta especial", cta_label: "Garantir meu manual" },
  ];
}

// Envia a capa para a biblioteca (uma vez só: reaproveita se o produto já tem capa).
async function ensureCover(product) {
  if (product.image_id) return product.image_id;
  const image = await processImage(await fs.readFile(COVER_FILE));
  const key = await storage.save(image.data);
  const { rows } = await pool.query(
    `INSERT INTO media (storage_key, mime_type, size_bytes, width, height, original_name, alt_text)
     VALUES ($1, 'image/webp', $2, $3, $4, 'cover-reforma.png', $5) RETURNING id`,
    [key, image.size, image.width, image.height, `Capa do ${PRODUCT.title}`]
  );
  await pool.query("UPDATE products SET image_id = $2, updated_at = now() WHERE id = $1", [product.id, rows[0].id]);
  return rows[0].id;
}

async function main() {
  let { rows } = await pool.query("SELECT id, image_id FROM products WHERE slug = $1", [SLUG]);
  if (rows.length) {
    console.log(`Produto "${SLUG}" já existe: mantendo os dados do cadastro e regravando a página.`);
  } else {
    ({ rows } = await pool.query(
      `INSERT INTO products (title, slug, category, featured, short_description, format, price_cents, checkout_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft') RETURNING id, image_id`,
      [PRODUCT.title, SLUG, PRODUCT.category, PRODUCT.featured, PRODUCT.short_description,
        PRODUCT.format, PRODUCT.price_cents, PRODUCT.checkout_url]
    ));
    console.log(`Produto "${SLUG}" criado como rascunho.`);
  }
  const product = rows[0];
  const coverId = await ensureCover(product);

  const { created } = await savePage(product.id, {
    sections: sections(coverId),
    seo_title: PRODUCT.title,
    seo_description: "Entenda IBS, CBS e Imposto Seletivo de forma prática, sem juridiquês. Manual digital por Lucas Coutinho.",
  });
  console.log(`Página de vendas ${created ? "criada" : "atualizada"} (não publicada).`);
  console.log(`Pré-visualização (logado no painel): /admin/preview/${product.id}`);
}

// Executado direto (node scripts/import-manual.js): importa. Carregado com require() (ex.: em
// testes): só fornece o conteúdo original, sem tocar no banco.
if (require.main === module) {
  main()
    .catch((error) => { console.error("Falha na importação:", error.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { MANUAL_SECTIONS: sections, MANUAL_PRODUCT: PRODUCT };
