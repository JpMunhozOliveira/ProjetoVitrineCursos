// Cores da página: paletas prontas (amostra do fundo + botão) ou personalizada (2 seletores de cor).
// As regras de contraste ficam no servidor (sales/theme.js): se uma combinação for recusada,
// a pré-visualização mostra o motivo e mantém a última versão válida.
import { useId } from "react";
import { useEditor } from "../state/context.js";

// Tema salvo ({ preset } ou { preset: "custom", hero, accent }) -> tema completo para o editor.
export function resolveTheme(stored, schema) {
  const preset = stored?.preset || schema.defaultTheme;
  if (preset === "custom" && stored.hero && stored.accent) return { preset, hero: stored.hero, accent: stored.accent };
  const base = schema.themes[preset] || schema.themes[schema.defaultTheme];
  return { preset: schema.themes[preset] ? preset : schema.defaultTheme, hero: base.hero, accent: base.accent };
}

function Swatch({ hero, accent }) {
  return (
    <span className="swatch" aria-hidden="true">
      <span className="swatch-hero" style={{ background: `linear-gradient(135deg, ${hero}, ${hero}cc)` }}>
        <span className="swatch-btn" style={{ background: accent }} />
      </span>
    </span>
  );
}

export function ThemePicker({ theme }) {
  const { schema, dispatch } = useEditor();
  const name = useId();
  // merge: arrastar o seletor de cor gera muitas alterações seguidas — viram um passo só no desfazer.
  const set = (value, merge = false) => dispatch({ type: "set", path: ["theme"], value, merge });
  const isCustom = theme.preset === "custom";

  return (
    <fieldset className="seo theme-picker">
      <legend>Cores da página</legend>
      <p className="hint">Fundo das faixas escuras (abertura, oferta final, destaque) e cor do botão de compra. O texto e os tons intermediários são ajustados automaticamente para manter a leitura.</p>
      <div className="theme-options" role="radiogroup" aria-label="Paleta de cores">
        {Object.entries(schema.themes).map(([key, t]) => (
          <label key={key} className="theme-option">
            <input type="radio" name={name} checked={theme.preset === key}
              onChange={() => set({ preset: key, hero: t.hero, accent: t.accent })} />
            <Swatch hero={t.hero} accent={t.accent} />
            <span className="theme-name">{t.label}</span>
          </label>
        ))}
        <label className="theme-option">
          <input type="radio" name={name} checked={isCustom}
            onChange={() => set({ preset: "custom", hero: theme.hero, accent: theme.accent })} />
          <Swatch hero={theme.hero} accent={theme.accent} />
          <span className="theme-name">Personalizar</span>
        </label>
      </div>
      {isCustom && (
        <div className="theme-custom">
          <ColorField label="Fundo das faixas" value={theme.hero} onChange={(hero) => set({ ...theme, hero }, true)} />
          <ColorField label="Botão de compra" value={theme.accent} onChange={(accent) => set({ ...theme, accent }, true)} />
        </div>
      )}
    </fieldset>
  );
}

function ColorField({ label, value, onChange }) {
  const id = useId();
  return (
    <div className="field color-field">
      <label htmlFor={id}>{label}</label>
      <div className="color-row">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <code>{value.toUpperCase()}</code>
      </div>
    </div>
  );
}
