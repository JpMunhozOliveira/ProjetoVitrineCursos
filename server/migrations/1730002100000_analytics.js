/* Resumo do painel: visitas e cliques no site + vendas da Kiwify.
   - site_events: uma linha por página vista ou clique em "comprar". Sem cookies e sem IP:
     visitor_hash é um resumo (hash) de IP + navegador com um "sal" que muda todo dia e fica só na
     memória do servidor, então conta visitantes do dia sem dar para seguir a pessoa entre dias.
     Linhas com mais de 13 meses são apagadas automaticamente (lib/analytics.js).
   - kiwify_sales: vendas copiadas da API da Kiwify (lib/kiwify-sales-sync.js). Só o necessário
     para os números: nenhum dado do comprador (nome, e-mail, CPF...) é guardado. */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE site_events (
      id BIGSERIAL PRIMARY KEY,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      type VARCHAR(20) NOT NULL CONSTRAINT site_events_type CHECK (type IN ('view', 'checkout_click')),
      path VARCHAR(300) NOT NULL,
      product_id UUID CONSTRAINT site_events_product_id_fkey REFERENCES products(id) ON DELETE SET NULL,
      ref_host VARCHAR(100),
      utm_source VARCHAR(100),
      utm_medium VARCHAR(100),
      utm_campaign VARCHAR(100),
      device VARCHAR(10) NOT NULL CONSTRAINT site_events_device CHECK (device IN ('mobile', 'tablet', 'desktop')),
      visitor_hash CHAR(16) NOT NULL
    );
    CREATE INDEX site_events_occurred_at_idx ON site_events (occurred_at);
    CREATE INDEX site_events_product_idx ON site_events (product_id, occurred_at) WHERE product_id IS NOT NULL;

    CREATE TABLE kiwify_sales (
      order_id VARCHAR(64) PRIMARY KEY,
      brand_id UUID NOT NULL CONSTRAINT kiwify_sales_brand_id_fkey REFERENCES brands(id) ON DELETE CASCADE,
      kiwify_product_id VARCHAR(64),
      product_name VARCHAR(200),
      status VARCHAR(30) NOT NULL,
      payment_method VARCHAR(30),
      charge_cents INTEGER,
      net_cents INTEGER,
      created_at TIMESTAMPTZ NOT NULL,
      approved_at TIMESTAMPTZ,
      utm_source VARCHAR(100),
      utm_medium VARCHAR(100),
      utm_campaign VARCHAR(100),
      synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX kiwify_sales_created_at_idx ON kiwify_sales (created_at);
    CREATE INDEX kiwify_sales_product_idx ON kiwify_sales (kiwify_product_id);

    -- Situação da última busca de vendas de cada conta (aviso no Resumo quando falha).
    ALTER TABLE kiwify_accounts
      ADD COLUMN sales_synced_at TIMESTAMPTZ,
      ADD COLUMN sales_sync_error VARCHAR(300);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE kiwify_accounts DROP COLUMN sales_sync_error, DROP COLUMN sales_synced_at;
    DROP TABLE kiwify_sales;
    DROP TABLE site_events;
  `);
};
