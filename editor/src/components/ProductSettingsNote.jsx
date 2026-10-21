// "Busca e compartilhamento": título e descrição da página (aba do navegador, Google e
// prévia do link no WhatsApp).
import { useEditor } from "../state/context.js";

export function SeoFields({ title, description }) {
  const { dispatch } = useEditor();
  // merge: digitação contínua vira um passo só no desfazer.
  const set = (field) => (e) => dispatch({ type: "set", path: [field], value: e.target.value, merge: true });
  return (
    <fieldset className="seo">
      <legend>Busca e compartilhamento</legend>
      <div className="field">
        <label htmlFor="seo_title">Título da página</label>
        <input id="seo_title" maxLength={220} value={title} aria-describedby="seo-title-help" onChange={set("seo_title")} />
        <p id="seo-title-help" className="hint">Aparece na aba do navegador, no Google e na prévia do link no WhatsApp. Vazio = título do produto.</p>
      </div>
      <div className="field">
        <label htmlFor="seo_description">Descrição</label>
        <textarea id="seo_description" rows={2} maxLength={320} value={description} aria-describedby="seo-desc-help" onChange={set("seo_description")} />
        <p id="seo-desc-help" className="hint">Uma ou duas frases (até 320 caracteres). Vazio = resumo do produto.</p>
      </div>
    </fieldset>
  );
}
