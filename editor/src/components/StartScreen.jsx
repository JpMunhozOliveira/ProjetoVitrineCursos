// Telas fora do fluxo normal de edição.

// Produto ainda sem página: começar pelo modelo padrão ou em branco.
export function StartScreen({ productUrl, onStart }) {
  return (
    <section className="start-box" aria-labelledby="start-title">
      <h2 id="start-title">Este produto ainda não tem página de vendas</h2>
      <p>Comece pelo modelo padrão — a mesma estrutura da página do Manual, com textos de orientação para você substituir — ou monte do zero.</p>
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => onStart(true)}>Usar o modelo padrão</button>
        <button type="button" className="btn btn-outline" onClick={() => onStart(false)}>Começar em branco</button>
        <a className="btn btn-outline" href={productUrl}>Voltar ao produto</a>
      </div>
    </section>
  );
}

// Celular: a página editável e os controles não cabem. Este aviso fica no HTML e o CSS
// (styles/editor.css) decide quando mostrá-lo no lugar do editor.
export function UnsupportedNotice({ productId, productUrl, hasPage, backLabel = "Voltar ao produto" }) {
  return (
    <div className="editor-unsupported" role="note">
      <h2>Editor disponível no tablet e no computador</h2>
      <p>A edição da página de vendas precisa de uma tela com pelo menos 768 px de largura (um tablet, ou o celular deitado em alguns modelos).</p>
      <div className="row-actions">
        {hasPage && <a className="btn btn-outline" href={`/admin/preview/${encodeURIComponent(productId)}`} target="_blank" rel="noopener">Ver versão salva<span className="sr-only"> (abre em nova aba)</span></a>}
        <a className="btn" href={productUrl}>{backLabel}</a>
      </div>
    </div>
  );
}
