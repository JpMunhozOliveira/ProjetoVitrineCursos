// Aviso no painel "Cores": o que aparece no Google e no WhatsApp (título e resumo do produto) e a
// marca da empresa ficam no cadastro do produto, não na página de vendas.
export function ProductSettingsNote({ productUrl }) {
  return (
    <fieldset className="panel-fieldset">
      <legend>Busca, compartilhamento e marca</legend>
      <p className="hint">
        No Google e no WhatsApp aparecem o título e o resumo do produto. Eles, e o nome e logo da
        empresa no menu, ficam em <a href={productUrl}>Editar produto</a>.
      </p>
    </fieldset>
  );
}
