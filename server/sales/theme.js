// Cores da página de vendas: fundo das faixas escuras (abertura, oferta final, destaque...) e
// cor do botão de compra. As demais cores são DERIVADAS daqui (tom do degradê, cor do texto
// sobre o fundo, texto do botão), garantindo contraste legível (WCAG AA) em qualquer escolha.

const THEMES = {
  marinho: { label: "Azul-marinho", hero: "#07152a", accent: "#f28a35" },
  floresta: { label: "Verde-floresta", hero: "#0f3326", accent: "#e8b94a" },
  vinho: { label: "Vinho", hero: "#3a0f1d", accent: "#e8b94a" },
  grafite: { label: "Grafite", hero: "#1d2026", accent: "#f2c14e" },
  roxo: { label: "Roxo", hero: "#24104a", accent: "#f0b429" },
  petroleo: { label: "Petróleo", hero: "#0b3440", accent: "#f4a259" },
};
const DEFAULT = "marinho";
const HEX = /^#[0-9a-f]{6}$/;

class ThemeError extends Error {}

/* ---------- Cálculo de cores (luminância e contraste, como no WCAG) ---------- */
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => toHex(toRgb(a).map((v, i) => v + (toRgb(b)[i] - v) * t)); // t=0 -> a, t=1 -> b
function luminance(hex) {
  const c = toRgb(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const LIGHT_TEXT = "#f4f6fa", DARK_TEXT = "#1a1405";
const bestText = (bg) => (contrast(LIGHT_TEXT, bg) >= contrast(DARK_TEXT, bg) ? LIGHT_TEXT : DARK_TEXT);

// Normaliza o que vem da API: { preset } ou { preset: "custom", hero, accent }.
// Devolve sempre { preset, hero, accent } resolvido. Lança ThemeError com mensagem amigável.
function normalizeTheme(input) {
  if (input === undefined || input === null) return { preset: DEFAULT, ...pick(THEMES[DEFAULT]) };
  if (typeof input !== "object" || Array.isArray(input)) throw new ThemeError("Cores da página: formato inválido.");
  const unknown = Object.keys(input).filter((k) => !["preset", "hero", "accent"].includes(k));
  if (unknown.length) throw new ThemeError(`Cores da página: campo(s) não suportado(s): ${unknown.join(", ")}.`);

  const preset = input.preset || DEFAULT;
  if (preset !== "custom") {
    // hasOwn: "constructor", "toString"... existem em todo objeto e não são paletas.
    if (typeof preset !== "string" || !Object.hasOwn(THEMES, preset)) throw new ThemeError("Cores da página: paleta desconhecida.");
    return { preset, ...pick(THEMES[preset]) };
  }
  const hero = String(input.hero || "").toLowerCase(), accent = String(input.accent || "").toLowerCase();
  if (!HEX.test(hero) || !HEX.test(accent)) throw new ThemeError("Cores da página: use cores no formato #RRGGBB.");
  checkColors(hero, accent);
  return { preset, hero, accent };
}
const pick = ({ hero, accent }) => ({ hero, accent });

// As faixas foram desenhadas para fundo escuro com texto claro; o botão precisa se destacar.
function checkColors(hero, accent) {
  if (contrast(LIGHT_TEXT, hero) < 4.5) {
    throw new ThemeError("Cores da página: o fundo das faixas está claro demais para o texto (que é claro). Escolha uma cor mais escura.");
  }
  if (contrast(accent, hero) < 3) {
    throw new ThemeError("Cores da página: o botão de compra não se destaca do fundo das faixas. Escolha cores mais diferentes entre si.");
  }
}

// Variáveis CSS a partir das duas cores escolhidas.
function themeVars(hero, accent) {
  const hero2 = mix(hero, "#ffffff", 0.12);                           // tom mais claro do degradê
  let muted = mix(LIGHT_TEXT, hero, 0.25);                            // texto secundário sobre o fundo
  if (contrast(muted, hero2) < 4.5) muted = LIGHT_TEXT;               // se não der contraste, usa o principal
  const onAccent = bestText(accent);
  const accentDark = mix(accent, onAccent === DARK_TEXT ? "#000000" : "#ffffff", 0.14); // hover do botão
  return {
    "--color-hero": hero, "--color-hero-2": hero2,
    "--color-on-hero": LIGHT_TEXT, "--color-on-hero-muted": muted,
    "--color-accent": accent, "--color-accent-dark": contrast(onAccent, accentDark) >= 4.5 ? accentDark : accent,
    "--color-on-accent": onAccent,
  };
}

// Folha de estilo com as variáveis (vale nos modos claro e escuro do site).
function themeStylesheet(hero, accent) {
  const vars = Object.entries(themeVars(hero, accent)).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `/* Cores da página de vendas (geradas pelo servidor). */\n:root, :root[data-theme] {\n${vars}\n}\n`;
}

// Endereço da folha de estilo para um tema (cores sem "#" na URL).
const themeHref = ({ hero, accent }) => `/page-theme.css?fundo=${hero.slice(1)}&botao=${accent.slice(1)}`;

module.exports = { THEMES, DEFAULT_THEME: DEFAULT, ThemeError, normalizeTheme, checkColors, themeStylesheet, themeHref };
