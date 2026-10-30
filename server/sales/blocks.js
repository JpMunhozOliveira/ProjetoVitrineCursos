// Esquema dos blocos da página de vendas: fonte única para validar o que chega na API,
// gerar o formulário do editor no painel e montar o modelo padrão de uma página nova.
//
// Tipos de campo:
//   text / textarea  -> texto (com tamanho máximo)
//   url              -> endereço de link (http, https ou mailto; sem esquema, ganha https://)
//   icon             -> um dos ícones de ICONS
//   image            -> ID de uma imagem da biblioteca (ou null)
//   bool             -> true/false
//   choice           -> uma das opções de "options" ({ valor: rótulo }); vazio = "default"
//   list             -> lista de itens; cada item tem seus próprios campos (item: {...})

// Ícones disponíveis nos blocos: nome, desenho (SVG 24×24, um único <path>) e espessura do traço.
// Fonte única: a página pública monta o sprite a partir daqui (render.js) e o editor mostra os
// mesmos desenhos. Vários desenhos foram adaptados do Lucide (lucide.dev, licença ISC,
// Copyright (c) Lucide Contributors) para um só <path>.
const ICONS = {
  check: { label: "Confirmação", d: "M5 12.5l4.5 4.5L19 7.5", width: 2.6 },
  x: { label: "Negação", d: "M6 6l12 12M18 6L6 18", width: 2.6 },
  doc: { label: "Documento", d: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
  bolt: { label: "Raio", d: "M13 3L5 14h6l-1 7 8-11h-6z" },
  shield: { label: "Escudo", d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" },
  user: { label: "Pessoa", d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6" },
  calc: { label: "Calculadora", d: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 7h8M8 12h2M12 12h2M8 16h2M12 16h2" },
  // Estudo e conteúdo
  book: { label: "Livro", d: "M4 19V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14M8 7h8" },
  cap: { label: "Formatura", d: "M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6" },
  video: { label: "Vídeo", d: "M3 5h18v14H3zM10 9l5 3-5 3z" },
  layers: { label: "Módulos", d: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5" },
  clipboard: { label: "Lista de tarefas", d: "M9 3h6v3H9zM7 4H5v17h14V4h-2M9 13l2 2 4-4" },
  folder: { label: "Pasta", d: "M3 6h6l2 2h10v11H3z" },
  pencil: { label: "Lápis", d: "M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3" },
  bulb: { label: "Ideia", d: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" },
  search: { label: "Lupa", d: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5" },
  download: { label: "Download", d: "M12 4v11M7 10l5 5 5-5M5 20h14" },
  laptop: { label: "Computador", d: "M5 5h14v10H5zM2 19h20" },
  mobile: { label: "Celular", d: "M8 3h8v18H8zM11 18h2" },
  // Tempo e progresso
  clock: { label: "Relógio", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" },
  calendar: { label: "Calendário", d: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4" },
  refresh: { label: "Atualização", d: "M20 11a8 8 0 0 0-14-5L4 8M4 3v5h5M4 13a8 8 0 0 0 14 5l2-2M20 21v-5h-5" },
  target: { label: "Alvo", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01" },
  trend: { label: "Crescimento", d: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  chart: { label: "Gráfico de barras", d: "M4 20h16M7 16v-5M12 16V7M17 16v-8" },
  pie: { label: "Gráfico de pizza", d: "M12 3v9h9a9 9 0 1 1-9-9zM15 3.5A9 9 0 0 1 20.5 9H15z" },
  flag: { label: "Bandeira", d: "M5 21V4M5 4h12l-2 4 2 4H5" },
  // Contabilidade, tributos e dinheiro
  money: { label: "Dinheiro", d: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4" },
  card: { label: "Cartão", d: "M3 6h18v12H3zM3 10h18M7 15h4" },
  percent: { label: "Porcentagem", d: "M19 5L5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  receipt: { label: "Nota fiscal", d: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" },
  scale: { label: "Balança (legislação)", d: "M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" },
  building: { label: "Empresa", d: "M4 21V5l8-2v18M12 8h8v13M8 8v.01M8 12v.01M8 16v.01M16 12v.01M16 16v.01M2 21h20" },
  briefcase: { label: "Maleta", d: "M3 8h18v12H3zM8 8V5h8v3M3 13h18" },
  // Pessoas e contato
  users: { label: "Grupo", d: "M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 7-5s7 2 7 5M17 4a3 3 0 0 1 0 6M19 15c2 .7 3 2.3 3 5" },
  chat: { label: "Conversa", d: "M4 5h16v11H10l-5 4v-4H4zM8 9h8M8 12h5" },
  mail: { label: "E-mail", d: "M3 5h18v14H3zM3 7l9 6 9-6" },
  phone: { label: "Telefone", d: "M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" },
  headset: { label: "Suporte", d: "M4 15v-3a8 8 0 0 1 16 0v3M4 14h3v6H4zM17 14h3v6h-3zM20 20a2 2 0 0 1-2 2h-4" },
  globe: { label: "Internet", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" },
  pin: { label: "Local", d: "M12 21s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  // Confiança e destaque
  lock: { label: "Cadeado", d: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3M12 15v2" },
  star: { label: "Estrela", d: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z" },
  award: { label: "Medalha", d: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7" },
  heart: { label: "Coração", d: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" },
  thumb: { label: "Aprovado", d: "M7 10v11H3V10zM7 10l4-7c1.5 0 2.5 1 2 3l-1 4h6a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 16.7 21H7" },
  gift: { label: "Bônus", d: "M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7c-1.5-3-5-3.5-5-1.2C7 7 9 7 12 7zM12 7c1.5-3 5-3.5 5-1.2C17 7 15 7 12 7z" },
  eye: { label: "Visão", d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
  info: { label: "Informação", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01" },
  alert: { label: "Atenção", d: "M12 3l10 18H2zM12 10v4M12 17h.01" },
  // Contabilidade e fiscal (mais)
  sheet: { label: "Planilha", d: "M4 3h16v18H4zM4 9h16M4 15h16M10 3v18" },
  bank: { label: "Banco", d: "M3 21h18M5 21v-9M10 21v-9M14 21v-9M19 21v-9M2 10l10-7 10 7z" },
  safe: { label: "Cofre", d: "M3 4h18v15H3zM7 19v2M17 19v2M12 15a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 11.5h.01M17 8v4" },
  stamp: { label: "Carimbo", d: "M5 21h14M5 17h14v-3a2 2 0 0 0-2-2h-3V9a3 3 0 1 0-4 0v3H7a2 2 0 0 0-2 2z" },
  coin: { label: "Moeda", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 8.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.3 0 3.2 6 1.8 6 5 0 1.4-1.3 2.2-3 2.2-1.4 0-2.5-.6-3.1-1.6M12 5.5V7M12 17v1.5" },
  coins: { label: "Moedas", d: "M9 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM18.1 10.4a6 6 0 1 1-7.7 7.7M7 6h1v4M16.7 13.9l.7.7-2.8 2.8" },
  wallet: { label: "Carteira", d: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" },
  piggy: { label: "Poupança", d: "M5 11a7 6 0 0 1 13-3h2v4h-1.5a7 6 0 0 1-2.5 3.5V19h-3v-2h-3v2H7v-3.5A6 6 0 0 1 5 11zM2 9c0 1.5 1 2 3 2M15 10h.01M10 6h4" },
  barcode: { label: "Boleto (código de barras)", d: "M3 5v14M6 5v14M10 5v14M12 5v14M16 5v14M19 5v14M21 5v14" },
  tax: { label: "Imposto", d: "M6 2h9l4 4v16H6zM15 2v4h4M9 18l6-7M9.5 12.5h.01M14.5 16.5h.01" },
  files: { label: "Documentos", d: "M8 7h9l3 3v11H8zM17 7v3h3M4 17V3h9" },
  contract: { label: "Contrato", d: "M14 3H6v18h12V7zM14 3v4h4M9 9h2M9 13h6M8 18c1-1.5 2-1.5 2.5 0s1.5 1.5 2.5 0 2 0 3 0" },
  signature: { label: "Assinatura", d: "M3 17c3-6 5-9 6-9s0 6 1 6 2-3 3-3 1 2 2 2 2-1 3-1M3 21h18" },
  ledger: { label: "Livro-caixa", d: "M5 3h14v18H5zM9 3v18M12 8h4M12 12h4M12 16h4" },
  archive: { label: "Arquivo", d: "M3 4h18v4H3zM5 8v12h14V8M10 12h4" },
  "linechart": { label: "Gráfico de linha", d: "M3 3v18h18M7 15l4-5 3 3 5-6" },
  "trenddown": { label: "Queda", d: "M3 7l6 6 4-4 8 8M15 17h6v-6" },
  exchange: { label: "Câmbio / troca", d: "M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" },
  deadline: { label: "Prazo", d: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4" },
  "checkcircle": { label: "Aprovado (círculo)", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6" },
  // Estudo e conteúdo (mais)
  board: { label: "Aula (quadro)", d: "M3 4h18v12H3zM7 20l3-4M17 20l-3-4M7 8h7M7 11h4" },
  presentation: { label: "Apresentação", d: "M2 3h20M4 3v11h16V3M12 14v4M8 21l4-3 4 3M8 10l3-3 2 2 3-3" },
  certificate: { label: "Certificado", d: "M8 16H3V4h18v12h-3.5M7 8h10M7 11h4M15 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM13.5 16.5L13 21l2-1 2 1-.5-4.5" },
  play: { label: "Play", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5l5 3.5-5 3.5z" },
  pause: { label: "Pausa", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 9v6M14 9v6" },
  headphones: { label: "Fone de ouvido", d: "M3 18v-6a9 9 0 0 1 18 0v6M3 14h4v7H5a2 2 0 0 1-2-2zM21 14h-4v7h2a2 2 0 0 0 2-2z" },
  mic: { label: "Microfone", d: "M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" },
  quiz: { label: "Pergunta", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" },
  notebook: { label: "Caderno", d: "M6 3h13v18H6zM3 7h3M3 12h3M3 17h3M10 8h5" },
  pen: { label: "Caneta", d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" },
  highlighter: { label: "Marca-texto", d: "M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" },
  "bookopen": { label: "Livro aberto", d: "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" },
  library: { label: "Biblioteca", d: "M4 4h3v16H4zM9 4h3v16H9zM14.5 5l3-.8 3.5 15-3 .8z" },
  ruler: { label: "Régua", d: "M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2" },
  backpack: { label: "Mochila", d: "M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 21v-5h8v5M8 11h8" },
  brain: { label: "Cérebro", d: "M12 5a3 3 0 0 0-5.8-1A3 3 0 0 0 4 8.5a3 3 0 0 0 0 5 3 3 0 0 0 2 5.3A3 3 0 0 0 12 19zM12 5a3 3 0 0 1 5.8-1A3 3 0 0 1 20 8.5a3 3 0 0 1 0 5 3 3 0 0 1-2 5.3A3 3 0 0 1 12 19zM12 5v14" },
  hourglass: { label: "Ampulheta", d: "M6 2h12M6 22h12M7 2v4l5 6 5-6V2M7 22v-4l5-6 5 6v4" },
  stopwatch: { label: "Cronômetro", d: "M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4l2 2M10 2h4M19 6l1.5-1.5" },
  captions: { label: "Legendas", d: "M3 5h18v14H3zM7 15h4M13 15h4M7 11h2M11 11h6" },
  letters: { label: "Letras / idiomas", d: "M3 16l3.5-9 3.5 9M4.3 13h4.4M13 7h3.5a2 2 0 0 1 0 4H13zM13 11h4a2 2 0 0 1 0 4h-4z" },
  // Negócios e marketing
  rocket: { label: "Foguete", d: "M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1zM12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2zM9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5" },
  megaphone: { label: "Megafone", d: "M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6" },
  handshake: { label: "Aperto de mãos", d: "M11 17l2 2a1 1 0 0 0 3-3M14 14l2.5 2.5a1 1 0 0 0 3-3l-3.9-3.9a3 3 0 0 0-4.2 0l-.9.9a1 1 0 1 1-3-3l2.8-2.8a5.8 5.8 0 0 1 7.1-.9l.5.3a2 2 0 0 0 1.4.3L21 4M21 3l1 11h-2M3 3L2 14l6.5 6.5a1 1 0 0 0 3-3M3 4h8" },
  cart: { label: "Carrinho", d: "M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21.5 7H6M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" },
  bag: { label: "Sacola", d: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" },
  tag: { label: "Etiqueta de preço", d: "M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4zM7.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" },
  discount: { label: "Desconto", d: "M12 2L14.1 4L17 3.3L17.9 6.1L20.7 7L20 9.9L22 12L20 14.1L20.7 17L17.9 17.9L17 20.7L14.1 20L12 22L9.9 20L7 20.7L6.1 17.9L3.3 17L4 14.1L2 12L4 9.9L3.3 7L6.1 6.1L7 3.3L9.9 4zM9 15l6-6M9.5 9.5h.01M14.5 14.5h.01" },
  funnel: { label: "Funil", d: "M3 4h18l-7 8.5V19l-4 2v-8.5z" },
  network: { label: "Conexões", d: "M12 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM19 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10.8 8.8l-4.6 6.4M13.2 8.8l4.6 6.4M7.5 17.5h9" },
  org: { label: "Organograma", d: "M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4" },
  trophy: { label: "Troféu", d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" },
  podium: { label: "Pódio", d: "M3 21h18M9 21V9h6v12M3 21v-7h6M15 21v-4h6v4" },
  diamond: { label: "Diamante", d: "M6 3h12l4 6-10 12L2 9zM2 9h20M10 3L8 9l4 12 4-12-2-6" },
  crown: { label: "Coroa", d: "M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5zM5 21h14" },
  flame: { label: "Fogo", d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.5 1.2 2.7 2.5 2.7z" },
  magnet: { label: "Ímã", d: "M6 15l-4-4 6.8-6.8a7.1 7.1 0 0 1 10 10L12 21l-4-4 6.8-6.8a1.4 1.4 0 0 0-2-2zM5 8l4 4M12 15l4 4" },
  puzzle: { label: "Quebra-cabeça", d: "M4 4h6a2 2 0 1 1 4 0h6v6a2 2 0 1 0 0 4v6h-6a2 2 0 1 0-4 0H4v-6a2 2 0 1 1 0-4z" },
  growth: { label: "Seta de crescimento", d: "M7 17L17 7M8 7h9v9" },
  store: { label: "Loja", d: "M3 9l1.5-5h15L21 9M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9zM5 13v8h14v-8M10 21v-5h4v5" },
  package: { label: "Pacote", d: "M12 22l-9-5V7l9-5 9 5v10zM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5" },
  share: { label: "Compartilhar", d: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" },
  infinity: { label: "Ilimitado", d: "M12 12c-2-2.7-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.3 6-4zm0 0c2 2.7 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.3-6 4z" },
  // Gerais e interface
  "arrowleft": { label: "Seta para a esquerda", d: "M19 12H5M12 19l-7-7 7-7" },
  "arrowright": { label: "Seta para a direita", d: "M5 12h14M12 5l7 7-7 7" },
  "arrowup": { label: "Seta para cima", d: "M12 19V5M5 12l7-7 7 7" },
  "arrowdown": { label: "Seta para baixo", d: "M12 5v14M19 12l-7 7-7-7" },
  plus: { label: "Mais", d: "M12 5v14M5 12h14", width: 2.2 },
  minus: { label: "Menos", d: "M5 12h14", width: 2.2 },
  home: { label: "Casa", d: "M3 10l9-7 9 7v11h-6v-7H9v7H3z" },
  gear: { label: "Engrenagem", d: "M10.2 4.8L10.4 2.1L13.6 2.1L13.8 4.8L15.8 5.7L17.9 3.9L20.1 6.1L18.3 8.2L19.2 10.2L21.9 10.4L21.9 13.6L19.2 13.8L18.3 15.8L20.1 17.9L17.9 20.1L15.8 18.3L13.8 19.2L13.6 21.9L10.4 21.9L10.2 19.2L8.2 18.3L6.1 20.1L3.9 17.9L5.7 15.8L4.8 13.8L2.1 13.6L2.1 10.4L4.8 10.2L5.7 8.2L3.9 6.1L6.1 3.9L8.2 5.7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
  cloud: { label: "Nuvem", d: "M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z" },
  link: { label: "Link", d: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7.1l1.7-1.7" },
  external: { label: "Link externo", d: "M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" },
  paperclip: { label: "Anexo", d: "M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" },
  bell: { label: "Notificação", d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" },
  sun: { label: "Sol", d: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" },
  moon: { label: "Lua", d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" },
  sparkles: { label: "Brilho", d: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15v4M17 17h4M5 3v3M3.5 4.5h3" },
  grid: { label: "Grade", d: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
  list: { label: "Lista", d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
  edit: { label: "Editar", d: "M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" },
  trash: { label: "Lixeira", d: "M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" },
  "eyeoff": { label: "Oculto", d: "M9.9 4.2A9.1 9.1 0 0 1 12 4c6 0 10 8 10 8a18 18 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s4 8 10 8a9.7 9.7 0 0 0 5.4-1.6M14.1 14.2a3 3 0 1 1-4.2-4.2M2 2l20 20" },
  key: { label: "Chave", d: "M7.5 21a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM11.4 11.6L21 2M16 7l3 3M18.5 4.5l2 2" },
  wifi: { label: "Wi-Fi", d: "M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 20h.01" },
  map: { label: "Mapa", d: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" },
  camera: { label: "Câmera", d: "M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  image: { label: "Imagem", d: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" },
  smile: { label: "Sorriso", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" },
  printer: { label: "Impressora", d: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" },
  send: { label: "Enviar", d: "M22 2L11 13M22 2l-7 20-4-9-9-4z" },
  coffee: { label: "Café", d: "M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v3M10 2v3M14 2v3" },
};

// Ícones das redes sociais (botões de link do autor e bloco "Redes sociais"). Ficam fora de ICONS:
// não entram no seletor de ícones; o sprite os inclui como #i-net-<nome>.
const NETWORKS = {
  instagram: { label: "Instagram", d: "M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.3 6.7h.01" },
  linkedin: { label: "LinkedIn", d: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 10.5V17M8 7.2v.01M12 17v-6.5M12 13.5a2.8 2.8 0 0 1 5.6 0V17" },
  youtube: { label: "YouTube", d: "M2.6 7.6c.3-1.5 1.4-2.5 2.9-2.7C7.8 4.6 9.9 4.5 12 4.5s4.2.1 6.5.4c1.5.2 2.6 1.2 2.9 2.7.3 1.5.4 2.9.4 4.4s-.1 2.9-.4 4.4c-.3 1.5-1.4 2.5-2.9 2.7-2.3.3-4.4.4-6.5.4s-4.2-.1-6.5-.4c-1.5-.2-2.6-1.2-2.9-2.7C2.3 14.9 2.2 13.5 2.2 12s.1-2.9.4-4.4zM10 9l5 3-5 3z" },
  whatsapp: { label: "WhatsApp", d: "M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4zM9 8.2c-.4 2.8 3.9 7.1 6.8 6.8l.9-1.5-2.2-1.1-1 .9a5 5 0 0 1-2.8-2.8l.9-1-1.1-2.2z" },
  facebook: { label: "Facebook", d: "M15.5 3H13a4 4 0 0 0-4 4v3H7v3.8h2V21h3.8v-7.2h2.4l.5-3.8h-2.9V7.6c0-.5.3-.8.8-.8h1.9z" },
  tiktok: { label: "TikTok", d: "M13.5 3v12a3.5 3.5 0 1 1-3.5-3.5M13.5 3c.4 2.9 2.4 4.7 5.5 5" },
  x: { label: "X (Twitter)", d: "M4 4h4.5L20 20h-4.5zM19.5 4l-6.6 7.3M4.5 20l6.6-7.3" },
  site: { label: "Site", d: ICONS.globe.d },
  email: { label: "E-mail", d: ICONS.mail.d },
};

// Grupos do seletor de ícones do editor (cada ícone em exatamente um grupo).
const ICON_GROUPS = [
  ["Básicos", ["check", "x", "doc", "bolt", "shield", "user", "calc", "checkcircle", "plus", "minus",
    "arrowleft", "arrowright", "arrowup", "arrowdown", "growth"]],
  ["Estudo e conteúdo", ["book", "bookopen", "cap", "certificate", "board", "presentation", "video", "play", "pause",
    "headphones", "mic", "captions", "layers", "clipboard", "notebook", "folder", "pencil", "pen", "highlighter",
    "bulb", "brain", "quiz", "letters", "search", "library", "ruler", "backpack", "download", "laptop", "mobile"]],
  ["Tempo e progresso", ["clock", "stopwatch", "hourglass", "calendar", "deadline", "refresh", "target", "trend",
    "trenddown", "chart", "linechart", "pie", "flag"]],
  ["Contabilidade, tributos e dinheiro", ["money", "coin", "coins", "wallet", "piggy", "card", "percent", "tax",
    "receipt", "barcode", "sheet", "ledger", "files", "contract", "signature", "stamp", "archive", "exchange",
    "scale", "bank", "safe", "building", "briefcase"]],
  ["Negócios e marketing", ["rocket", "megaphone", "handshake", "cart", "bag", "tag", "discount", "store", "package",
    "funnel", "network", "org", "share", "trophy", "podium", "diamond", "crown", "flame", "magnet", "puzzle", "infinity"]],
  ["Pessoas e contato", ["users", "chat", "mail", "phone", "headset", "globe", "pin", "send", "smile"]],
  ["Confiança e destaque", ["lock", "key", "star", "award", "heart", "thumb", "gift", "sparkles", "eye", "eyeoff",
    "info", "alert", "bell"]],
  ["Gerais", ["home", "gear", "cloud", "link", "external", "paperclip", "sun", "moon", "grid", "list", "edit", "trash",
    "wifi", "map", "camera", "image", "printer", "coffee"]],
];

const text = (label, max, extra = {}) => ({ type: "text", label, max, ...extra });
const textarea = (label, max, extra = {}) => ({ type: "textarea", label, max, ...extra });
const url = (label, extra = {}) => ({ type: "url", label, max: 500, ...extra });
const icon = (label = "Ícone") => ({ type: "icon", label });
const image = (label, extra = {}) => ({ type: "image", label, ...extra });
const bool = (label) => ({ type: "bool", label });
// noun: nome de UM item (no editor, o botão "Adicionar <noun>" no fim da lista, direto na página).
const list = (label, max, item, noun = "item", extra = {}) => ({ type: "list", label, max, item, noun, ...extra });
const choice = (label, options, fallback, extra = {}) => ({ type: "choice", label, options, default: fallback, ...extra });

// Campos de aparência, comuns a vários blocos.
// Rótulo: texto curto em caixa alta acima do título (ex.: "CONTEÚDO DO CURSO").
const eyebrow = () => text("Rótulo acima do título", 40, { help: "Opcional. Texto curto que aparece em caixa alta acima do título." });
// Descrição curta e centralizada logo abaixo do título da seção.
const intro = () => text("Descrição abaixo do título", 280, { help: "Opcional. Texto curto e centralizado que apresenta a seção." });
// Fundo da seção. "Automático": o padrão do bloco (claro e cinza se alternam; o Autor é escuro).
const background = () => choice("Fundo da seção", { auto: "Automático", light: "Claro", soft: "Cinza", dark: "Escuro" }, "auto");
// Colunas da grade no computador (ex.: 8 itens em 4 colunas = 4×2). No celular é sempre uma coluna.
const columns = () => choice("Colunas (no computador)", { auto: "Automático", two: "2 colunas", three: "3 colunas", four: "4 colunas" }, "auto",
  { help: "Ex.: 8 tópicos em 4 colunas formam uma grade 4×2; 6 em 3 colunas, 3×2." });

const BLOCKS = {
  hero: {
    label: "Abertura",
    help: "Primeira dobra da página: título, chamada, selos, preço e botão de compra. Preço e link de checkout vêm do cadastro do produto.",
    fields: {
      logo: image("Logotipo (opcional)", { size: "400 × 120 px", tip: "PNG com fundo transparente" }),
      eyebrow: eyebrow(),
      title: text("Título", 200, { help: "Vazio = usa o título do produto." }),
      lead: textarea("Chamada", 600),
      badges: list("Selos", 6, { strong: text("Destaque", 30), text: text("Complemento", 40) }, "selo"),
      price_label: text("Texto acima do preço", 40, { placeholder: "Por apenas" }),
      cta_label: text("Texto do botão", 60, { placeholder: "Comprar agora" }),
      stats: list("Números em destaque", 4, {
        value: text("Número", 12, { help: "Ex.: 6, 18h, 1 ano." }), label: text("Texto", 30, { help: "Ex.: módulos, de aula, de acesso." }),
      }, "número"),
      visual: choice("Estilo do visual", {
        image: "Imagem única",
        book: "Livro / manual 3D",
        stack: "Composição 3D (várias imagens)",
        mosaic: "Mosaico (várias imagens)",
        screen: "Tela (moldura de janela)",
        devices: "Notebook e celular",
        video: "Vídeo (play)",
      }, "image", {
        help: "Livro: a imagem principal vira a capa de um livro em 3D. Composição e mosaico: a principal e as imagens extras. Tela: a principal numa janela (telas de software). Notebook e celular: a principal no notebook e a 1ª imagem extra no celular. Vídeo: a principal como capa, com o botão de play do vídeo de apresentação.",
        // Miniatura de cada estilo no editor (SVG 48×32, traço): as opções viram cartões.
        previews: {
          image: "M10 5h28v22H10zM10 22l8-7 6 6 4-4 10 9M31 11h.01",
          book: "M15 3h20v26H15zM15 3l-4 3v24l4-1M35 5h2v22h-2M19 10h12M19 14h8",
          stack: "M6 11h14v18H6zM17 7h14v18H17zM29 3h13v17H29z",
          mosaic: "M6 4h17v11H6zM25 4h17v11H25zM6 17h17v11H6zM25 17h17v11H25z",
          screen: "M5 4h38v24H5zM5 9h38M9 6.5h.01M12 6.5h.01M15 6.5h.01",
          devices: "M5 5h28v18H5zM1 26h36M36 11h9v18h-9zM39.5 26h2",
          video: "M5 4h38v24H5zM21 10l9 6-9 6z",
        },
      }),
      image: image("Imagem principal", { size: "1200 × 900 px", tip: "PNG com fundo transparente fica melhor" }),
      image_label: text("Etiqueta da imagem principal", 30, { help: "Opcional. Ex.: Manual em PDF." }),
      // showIf: o editor só mostra o campo quando o estilo usa ele (o valor fica guardado igual).
      video_url: url("Vídeo de apresentação (YouTube ou Vimeo)", { help: "Ex.: youtube.com/watch?v=… ou vimeo.com/…",
        showIf: { field: "visual", in: ["video"] } }),
      extra_images: list("Imagens extras (composição, celular, mosaico)", 3, {
        image: image("Imagem", { size: "900 × 1200 px", tip: "capa, página do manual ou fluxograma" }),
        label: text("Etiqueta", 30, { help: "Opcional. Ex.: Fluxogramas." }),
      }, "imagem", { showIf: { field: "visual", in: ["stack", "mosaic", "devices"] } }),
    },
  },
  benefits: {
    label: "Cartões de benefícios",
    help: "Dois a quatro cartões com os principais benefícios.",
    fields: {
      title: text("Título da seção (só para leitores de tela)", 120),
      items: list("Cartões", 4, {
        icon: icon(), title: text("Título", 80), text: textarea("Texto", 400), callout: text("Destaque", 200),
      }, "cartão"),
      background: background(),
    },
  },
  topics: {
    label: "Grade de tópicos",
    help: "O que a pessoa vai encontrar no produto (módulos, capítulos, temas). Com fundo escuro, vira um painel de conteúdo.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      intro: intro(),
      items: list("Tópicos", 12, { icon: icon(), title: text("Título", 80), text: textarea("Texto", 300) }, "tópico"),
      layout: choice("Formato", { grid: "Grade de cartões", timeline: "Linha do tempo (passo a passo)" }, "grid",
        { help: "Linha do tempo: os tópicos viram passos numerados (01, 02…) ligados por uma linha. Bom para a metodologia." }),
      columns: { ...columns(), showIf: { field: "layout", in: ["grid"] } },
      background: background(),
    },
  },
  gallery: {
    label: "Galeria (carrossel)",
    help: "Imagens do produto por dentro. Com título ou tópicos nas imagens, ao lado do carrossel aparece a lista do módulo que está na tela. Sem imagens, o bloco não aparece na página.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      intro: intro(),
      images: list("Imagens", 12, {
        image: image("Imagem", { required: true, size: "1500 × 1000 px" }),
        title: text("Título do módulo (opcional)", 80),
        topics: textarea("Tópicos do módulo (um por linha)", 600),
      }, "imagem"),
      background: background(),
    },
  },
  checklist: {
    label: "Lista ✓ / ✗",
    help: "O que o produto é e o que não é.",
    fields: {
      icon: icon(),
      eyebrow: eyebrow(),
      title: text("Título", 120),
      intro: intro(),
      items: list("Itens", 10, { text: text("Texto", 160), positive: bool("Positivo (✓)") }),
      background: background(),
    },
  },
  comparison: {
    label: "Comparativo",
    help: "Dois lados: a alternativa comum (✗) e o seu produto (✓).",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      intro: intro(),
      left_title: text("Título do lado ✗", 80),
      left_items: list("Itens do lado ✗", 8, { text: text("Texto", 160) }),
      right_title: text("Título do lado ✓", 80),
      right_items: list("Itens do lado ✓", 8, { text: text("Texto", 160) }),
      background: background(),
    },
  },
  author: {
    label: "Autor",
    help: "Quem criou o produto.",
    fields: {
      photo: image("Foto", { size: "600 × 700 px" }),
      eyebrow: eyebrow(),
      name: text("Nome", 120),
      role: text("Especialidade / cargo", 160),
      bio: textarea("Biografia", 1500),
      links: list("Links (Lattes, LinkedIn, site…)", 4, {
        label: text("Texto do botão", 40),
        url: url("Endereço", { help: "O ícone do botão é escolhido pelo endereço (LinkedIn, Lattes, Instagram…)." }),
      }, "link"),
      background: background(),
    },
  },
  audience: {
    label: "Público-alvo",
    help: "Para quem é o produto.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      intro: intro(),
      items: list("Perfis", 8, { icon: icon(), text: text("Texto", 60) }, "perfil"),
      columns: columns(),
      background: background(),
    },
  },
  highlight: {
    label: "Destaque",
    help: "Cartão escuro com chamada e lista (ex.: bônus, conteúdo extra).",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título", 120),
      text: textarea("Texto", 600),
      items: list("Itens", 8, { text: text("Texto", 160) }),
      background: background(),
    },
  },
  cta: {
    label: "Chamada intermediária",
    help: "Faixa escura e compacta com o botão de compra, para usar no meio da página. Preço e link vêm do cadastro do produto.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Texto", 160),
      cta_label: text("Texto do botão", 60, { placeholder: "Quero garantir" }),
    },
  },
  testimonials: {
    label: "Depoimentos",
    help: "O que clientes dizem do produto. Use só depoimentos reais. Depoimentos sem texto não aparecem.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      intro: intro(),
      items: list("Depoimentos", 9, {
        quote: textarea("Depoimento", 600),
        name: text("Nome", 80),
        role: text("Profissão / cidade (opcional)", 80),
        photo: image("Foto (opcional)", { size: "200 × 200 px", tip: "quadrada" }),
      }, "depoimento"),
      background: background(),
    },
  },
  faq: {
    label: "Perguntas frequentes",
    help: "Funciona sem JavaScript (cada pergunta abre e fecha).",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      intro: intro(),
      items: list("Perguntas", 20, { question: text("Pergunta", 200), answer: textarea("Resposta", 1500) }, "pergunta"),
      background: background(),
    },
  },
  guarantee: {
    label: "Garantia",
    help: "Faixa de confiança: selos de compra segura, suporte e condições.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título", 120),
      intro: intro(),
      items: list("Selos", 4, { icon: icon(), text: text("Texto", 80) }, "selo"),
      background: background(),
    },
  },
  social: {
    label: "Redes sociais",
    help: "Botões com os links das suas redes. Só aparecem as redes com link; sem nenhuma, o bloco não aparece na página.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      intro: intro(),
      items: list("Redes", 9, {
        network: choice("Rede", Object.fromEntries(Object.entries(NETWORKS).map(([k, n]) => [k, n.label])), "instagram"),
        url: url("Link", { help: "Ex.: instagram.com/seu.perfil, wa.me/5511999999999 ou um e-mail." }),
        label: text("Texto do botão (opcional)", 40, { help: "Vazio = o nome da rede." }),
      }, "rede"),
      background: background(),
    },
  },
  offer: {
    label: "Oferta final",
    help: "Última chamada: texto e benefícios à esquerda, cartão de compra à direita. Preço e link vêm do cadastro do produto.",
    fields: {
      image: image("Imagem (topo do cartão de compra)", { size: "1000 × 750 px", tip: "PNG com fundo transparente fica melhor" }),
      eyebrow: eyebrow(),
      title: text("Título", 200),
      text: textarea("Descrição", 600),
      items: list("Benefícios", 4, { icon: icon(), text: text("Texto", 100) }, "benefício"),
      proof_icon: icon("Ícone do cartão de credibilidade"),
      proof_title: text("Credibilidade: destaque", 80),
      proof_text: text("Credibilidade: texto", 200),
      price_label: text("Texto acima do preço", 40, { placeholder: "Oferta especial" }),
      conditions: list("Condições de acesso", 6, { text: text("Texto", 120) }, "condição"),
      guarantee_title: text("Garantia: título", 80, { placeholder: "Garantia de 7 dias" }),
      guarantee_text: text("Garantia: texto", 300),
      cta_label: text("Texto do botão", 60, { placeholder: "Garantir agora" }),
      note: text("Aviso abaixo do botão", 160, { help: "Vazio = \"Pagamento processado com segurança pela Kiwify.\"" }),
      seals: list("Selos de compra segura", 4, { icon: icon(), text: text("Texto", 40) }, "selo"),
    },
  },
  curriculum: {
    label: "Currículo (módulos)",
    help: "Módulos que abrem e fecham, cada um com a lista de aulas ou tópicos. Muita informação sem deixar a página longa.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      intro: intro(),
      items: list("Módulos", 20, {
        title: text("Título do módulo", 120),
        meta: text("Detalhe (opcional)", 60, { help: "Ex.: 5 aulas · 2h10." }),
        topics: textarea("Tópicos (um por linha)", 1500),
      }, "módulo"),
      background: background(),
    },
  },
  demo: {
    label: "Demonstração",
    help: "Mostre o produto por dentro em abas (ex.: Manual, Aula, Fluxograma). Abas sem imagem não aparecem.",
    fields: {
      eyebrow: eyebrow(),
      title: text("Título da seção", 120),
      intro: intro(),
      items: list("Abas", 4, {
        label: text("Nome da aba", 30),
        image: image("Imagem", { size: "1500 × 1000 px" }),
        caption: textarea("Legenda", 300),
      }, "aba"),
      background: background(),
    },
  },
  feature: {
    label: "Texto e imagem",
    help: "Linhas com texto de um lado e imagem do outro, alternando o lado a cada linha.",
    fields: {
      items: list("Linhas", 6, {
        eyebrow: text("Rótulo acima do título", 40),
        title: text("Título", 120),
        text: textarea("Texto", 800),
        bullets: textarea("Lista (um item por linha)", 600),
        image: image("Imagem", { size: "1200 × 900 px" }),
      }, "linha"),
      background: background(),
    },
  },
};

// Blocos salvos (aba "Blocos salvos" do painel): qualquer bloco pode ter o conteúdo cadastrado uma
// vez e usado em várias páginas (ex.: as redes sociais ou a apresentação de um professor). Na página fica só a referência { type, shared: id, ...campos locais };
// o resto vem do bloco salvo na hora de desenhar (ver resolveShared em pages.js).
// Valor: campos que continuam sendo de cada página (o fundo combina com os blocos vizinhos).
// Todo tipo entra; o fundo (quando o tipo tem) continua sendo escolhido em cada página.
const SHAREABLE = Object.fromEntries(Object.entries(BLOCKS)
  .map(([type, def]) => [type, Object.hasOwn(def.fields, "background") ? ["background"] : []]));

const pick = (fields, keep) => Object.fromEntries(Object.entries(fields).filter(([name]) => keep(name)));
// Campos que ficam na página / campos que vêm do bloco salvo.
const localFields = (type) => pick(BLOCKS[type].fields, (name) => SHAREABLE[type].includes(name));
const sharedFields = (type) => pick(BLOCKS[type].fields, (name) => !SHAREABLE[type].includes(name));

// Endereço digitado -> endereço seguro para href. Sem esquema: e-mail vira mailto:, o resto https://.
// Só http, https e mailto (bloqueia javascript:, data: etc.). Devolve null se for inválido.
function normalizeUrl(value) {
  let v = value.trim();
  if (!v) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = (/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(v) ? "mailto:" : "https://") + v;
  let parsed;
  try { parsed = new URL(v); } catch { return null; }
  if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return null;
  if (parsed.protocol !== "mailto:" && !parsed.hostname) return null;
  return v;
}

const { plain, canonical } = require("./richtext");

const MAX_BLOCKS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// Nome definido no próprio objeto (o operador "in" aceitaria também "constructor", "toString"...).
const has = (obj, key) => typeof key === "string" && Object.hasOwn(obj, key);

class ValidationError extends Error {}

// Valida e normaliza os campos de um objeto conforme "fields". "where" monta mensagens como
// "Bloco 3 (FAQ) › Perguntas › item 2 › Resposta".
function validateFields(input, fields, where) {
  if (!isObject(input)) throw new ValidationError(`${where}: formato inválido.`);
  const unknown = Object.keys(input).filter((k) => !has(fields, k));
  if (unknown.length) throw new ValidationError(`${where}: campo(s) não suportado(s): ${unknown.join(", ")}.`);

  const out = {};
  for (const [name, field] of Object.entries(fields)) {
    const value = input[name];
    const at = `${where} › ${field.label}`;
    switch (field.type) {
      case "text":
      case "textarea": {
        // Pode ter formatação (negrito, cor, alinhamento: ver richtext.js). O limite conta só o
        // texto visível; o limite bruto barra textos inflados de marcações.
        if (value !== undefined && value !== null && typeof value !== "string") throw new ValidationError(`${at}: deve ser texto.`);
        const v = (value || "").trim();
        if (plain(v).length > field.max) throw new ValidationError(`${at}: máximo de ${field.max} caracteres.`);
        if (v.length > field.max * 4 + 40) throw new ValidationError(`${at}: formatação demais para o tamanho do texto.`);
        out[name] = canonical(v);
        break;
      }
      case "url": {
        if (value !== undefined && value !== null && typeof value !== "string") throw new ValidationError(`${at}: deve ser texto.`);
        if ((value || "").trim().length > field.max) throw new ValidationError(`${at}: máximo de ${field.max} caracteres.`);
        const v = normalizeUrl(value || "");
        if (v === null) throw new ValidationError(`${at}: endereço inválido (use um link como https://site.com.br).`);
        out[name] = v;
        break;
      }
      case "icon":
        if (value !== undefined && value !== null && value !== "" && !has(ICONS, value)) throw new ValidationError(`${at}: ícone inválido.`);
        out[name] = value || "check";
        break;
      case "image":
        if (value !== undefined && value !== null && value !== "" && !(typeof value === "string" && UUID.test(value))) {
          throw new ValidationError(`${at}: imagem inválida.`);
        }
        if (field.required && !value) throw new ValidationError(`${at}: escolha uma imagem.`);
        out[name] = value || null;
        break;
      case "bool":
        if (value !== undefined && typeof value !== "boolean") throw new ValidationError(`${at}: deve ser verdadeiro ou falso.`);
        out[name] = !!value;
        break;
      case "choice":
        if (value !== undefined && value !== null && value !== "" && !has(field.options, value)) throw new ValidationError(`${at}: opção inválida.`);
        out[name] = value || field.default;
        break;
      case "list": {
        if (value !== undefined && !Array.isArray(value)) throw new ValidationError(`${at}: deve ser uma lista.`);
        const items = value || [];
        if (items.length > field.max) throw new ValidationError(`${at}: máximo de ${field.max} itens.`);
        out[name] = items.map((item, i) => validateFields(item, field.item, `${at} › item ${i + 1}`));
        break;
      }
      default:
        throw new Error(`Tipo de campo desconhecido: ${field.type}`);
    }
  }
  return out;
}

// Referência a um bloco salvo: só o ID e os campos locais (o conteúdo não pode vir junto).
function validateSharedRef({ type, shared, ...fields }, where) {
  if (!has(SHAREABLE, type)) throw new ValidationError(`${where}: este tipo de bloco não pode ser um bloco salvo.`);
  if (typeof shared !== "string" || !UUID.test(shared)) throw new ValidationError(`${where}: bloco salvo inválido.`);
  return { type, shared: shared.toLowerCase(), ...validateFields(fields, localFields(type), where) };
}

// Conteúdo de um bloco salvo (aba "Blocos salvos"). Devolve { data } normalizado ou { error }.
function validateSharedData(type, data) {
  try {
    if (!has(SHAREABLE, type)) throw new ValidationError("Tipo de bloco inválido.");
    return { data: validateFields(data ?? {}, sharedFields(type), BLOCKS[type].label) };
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}

// IDs dos blocos salvos usados numa lista de blocos.
const sharedIds = (sections) => [...new Set(sections.filter((b) => b.shared).map((b) => b.shared))];

// Valida a lista de blocos inteira. Devolve { sections } normalizado ou { error }.
function validateSections(sections) {
  try {
    if (!Array.isArray(sections)) throw new ValidationError("sections deve ser uma lista de blocos.");
    if (sections.length > MAX_BLOCKS) throw new ValidationError(`Use no máximo ${MAX_BLOCKS} blocos.`);
    const out = sections.map((block, i) => {
      if (!isObject(block) || !has(BLOCKS, block.type)) throw new ValidationError(`Bloco ${i + 1}: tipo inválido.`);
      const { type, ...fields } = block;
      const where = `Bloco ${i + 1} (${BLOCKS[type].label})`;
      if (Object.hasOwn(block, "shared")) return validateSharedRef(block, where);
      return { type, ...validateFields(fields, BLOCKS[type].fields, where) };
    });
    return { sections: out };
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}

// Blocos já gravados, validados UM A UM: um bloco inválido (ex.: dado antigo, de antes de uma
// mudança no esquema) é descartado sozinho, em vez de invalidar a página inteira. Cada item
// guarda a posição ORIGINAL do bloco: { index, block }.
function validBlocks(sections) {
  return (Array.isArray(sections) ? sections : [])
    .map((block, index) => ({ index, block: isObject(block) && has(BLOCKS, block.type) ? validateSections([block]).sections?.[0] : null }))
    .filter((x) => x.block);
}

// IDs de todas as imagens usadas nos blocos (para buscar URLs e registrar o uso).
function mediaIds(sections) {
  const ids = new Set();
  const walk = (value, fields) => {
    for (const [name, field] of Object.entries(fields)) {
      if (field.type === "image" && value[name]) ids.add(value[name]);
      if (field.type === "list") (value[name] || []).forEach((item) => walk(item, field.item));
    }
  };
  sections.forEach((block) => BLOCKS[block.type] && walk(block, BLOCKS[block.type].fields));
  return [...ids];
}

// Modelo padrão de uma página nova: a estrutura do Manual, com textos de orientação.
function defaultSections() {
  return [
    { type: "hero", eyebrow: "Material profissional", lead: "Uma frase que resume a transformação que o produto entrega.",
      badges: [{ strong: "PDF", text: "Prático" }, { strong: "Acesso", text: "Imediato" }],
      stats: [{ value: "6", label: "módulos" }, { value: "18h", label: "de aula" }, { value: "1 ano", label: "de acesso" }],
      price_label: "Por apenas", cta_label: "Comprar agora" },
    { type: "benefits", title: "Benefícios", items: [
      { icon: "bolt", title: "Primeiro benefício", text: "Explique o benefício em uma ou duas frases.", callout: "" },
      { icon: "doc", title: "Segundo benefício", text: "Explique o benefício em uma ou duas frases.", callout: "" }] },
    { type: "topics", eyebrow: "Metodologia", title: "Como você vai aprender", layout: "timeline", items: [
      { icon: "video", title: "Assista", text: "Aulas curtas e objetivas, organizadas por módulos." },
      { icon: "doc", title: "Estude o material", text: "Manual em PDF para estudo e consulta." },
      { icon: "eye", title: "Visualize", text: "Fluxogramas que mostram o processo de forma visual." },
      { icon: "target", title: "Aplique", text: "Casos práticos para usar no dia a dia." }] },
    { type: "gallery", eyebrow: "Por dentro", title: "Conheça por dentro", images: [] },
    { type: "demo", eyebrow: "Demonstração", title: "Veja o que você recebe", items: [
      { label: "Manual", caption: "Uma página do manual." }, { label: "Aula", caption: "Um trecho de aula." }] },
    { type: "feature", items: [
      { eyebrow: "Na prática", title: "Um diferencial do produto", text: "Explique o diferencial em poucas frases.", bullets: "Primeiro ponto\nSegundo ponto" },
      { eyebrow: "Para consultar", title: "Outro diferencial", text: "Explique o diferencial em poucas frases.", bullets: "" }] },
    { type: "cta", title: "Pronto para começar? O acesso é imediato.", cta_label: "Quero garantir" },
    { type: "curriculum", eyebrow: "Conteúdo", title: "O que você vai estudar", items: [
      { title: "Módulo de introdução", meta: "3 aulas", topics: "Primeiro tópico\nSegundo tópico" },
      { title: "Segundo módulo", meta: "4 aulas", topics: "Primeiro tópico\nSegundo tópico" }] },
    { type: "checklist", icon: "shield", title: "Conteúdo focado no que importa", items: [
      { text: "O que o produto não é", positive: false }, { text: "O que o produto entrega", positive: true }] },
    { type: "comparison", eyebrow: "Diferenciais", title: "Por que este material", left_title: "Alternativa comum",
      left_items: [{ text: "Ponto fraco da alternativa" }], right_title: "Este produto",
      right_items: [{ text: "Ponto forte do produto" }] },
    { type: "author", eyebrow: "Quem ensina", name: "Nome do autor", role: "Especialidade", bio: "Breve biografia." },
    { type: "audience", title: "Para quem é este material?", items: [{ icon: "user", text: "Perfil 1" }] },
    { type: "faq", eyebrow: "Dúvidas", title: "Dúvidas mais frequentes", items: [
      { question: "Em que formato recebo o produto?", answer: "Explique o formato e como acessar." },
      { question: "Tem garantia?", answer: "Explique a política de garantia." }] },
    { type: "offer", eyebrow: "Oferta", title: "Garanta agora o seu acesso",
      text: "Uma frase curta lembrando o que a pessoa leva e por que vale começar hoje.",
      items: [{ icon: "bolt", text: "Acesso imediato" }, { icon: "doc", text: "Conteúdo prático" },
        { icon: "refresh", text: "Atualizações incluídas" }, { icon: "headset", text: "Suporte por e-mail" }],
      proof_icon: "award", proof_title: "Feito por especialista", proof_text: "Material criado por quem vive o assunto na prática.",
      price_label: "Oferta especial",
      conditions: [{ text: "Pagamento único" }, { text: "Acesso imediato após a compra" }],
      guarantee_title: "Garantia de 7 dias", guarantee_text: "Se não gostar, devolvemos o seu dinheiro.",
      cta_label: "Quero me matricular agora",
      seals: [{ icon: "lock", text: "Pagamento seguro" }, { icon: "shield", text: "7 dias de garantia" }, { icon: "bolt", text: "Acesso imediato" }] },
  ].map((block) => validateSections([block]).sections[0]); // preenche os campos que faltam
}

module.exports = {
  ICONS, ICON_GROUPS, NETWORKS, BLOCKS, MAX_BLOCKS, SHAREABLE,
  validateSections, validBlocks, mediaIds, defaultSections, validateSharedData, sharedIds, sharedFields,
};
