CREATE OR REPLACE VIEW v_elo_tabelao AS
 WITH canal_lookup AS (
         SELECT t.canal,
            t.nome_canal
           FROM ( SELECT pedido_timeline.canal,
                    pedido_timeline.nome_canal,
                    count(*) AS n,
                    row_number() OVER (PARTITION BY pedido_timeline.canal ORDER BY (count(*)) DESC) AS rn
                   FROM pedido_timeline
                  WHERE ((pedido_timeline.nome_canal IS NOT NULL) AND ((pedido_timeline.nome_canal)::text <> ''::text))
                  GROUP BY pedido_timeline.canal, pedido_timeline.nome_canal) t
          WHERE (t.rn = 1)
        ), ult_tracking AS (
         SELECT DISTINCT ON (tracking_eventos.pedido_bseller) tracking_eventos.pedido_bseller,
            tracking_eventos.descricao,
            tracking_eventos.data_ocorrencia
           FROM tracking_eventos
          ORDER BY tracking_eventos.pedido_bseller, tracking_eventos.data_ocorrencia DESC, tracking_eventos.id DESC
        ), pedidos_dedup AS (
         SELECT DISTINCT ON (pedidos.id_entrega) pedidos.id,
            pedidos.pedido_bseller,
            pedidos.pedido_externo,
            pedidos.sequence_vtex,
            pedidos.data_pedido,
            pedidos.canal_real,
            pedidos.filial_id,
            pedidos.status,
            pedidos.valor_total,
            pedidos.cmv_total,
            pedidos.frete,
            pedidos.source_system,
            pedidos.source_api,
            pedidos.source_record_id,
            pedidos.ingested_at,
            pedidos.updated_at,
            pedidos.sync_run_id,
            pedidos.raw_payload_hash,
            pedidos.is_deleted,
            pedidos.last_seen_at,
            pedidos.ponto,
            pedidos.valor_total_entrega,
            pedidos.uf_destino,
            pedidos.cep_destino,
            pedidos.cidade_destino,
            pedidos.cpf_cliente,
            pedidos.nome_cliente,
            pedidos.email_cliente,
            pedidos.fone_cliente,
            pedidos.chave_nf_saida,
            pedidos.num_nf_saida,
            pedidos.id_entrega,
            pedidos.id_transportadora,
            pedidos.data_prometida
           FROM pedidos
          WHERE ((pedidos.is_deleted = false) AND (pedidos.data_pedido >= '2025-01-01 00:00:00+00'::timestamp with time zone))
          ORDER BY pedidos.id_entrega, (pedidos.num_nf_saida IS NOT NULL) DESC, pedidos.updated_at DESC
        ), itens_dedup AS (
         SELECT DISTINCT ON (pedido_itens.pedido_id, pedido_itens.cod_terceiro) pedido_itens.id,
            pedido_itens.pedido_id,
            pedido_itens.cod_terceiro,
            pedido_itens.id_fornecedor,
            pedido_itens.quantidade,
            pedido_itens.preco_unit_venda,
            pedido_itens.preco_unit_custo,
            pedido_itens.desconto,
            pedido_itens.source_api,
            pedido_itens.sync_run_id,
            pedido_itens.ingested_at
           FROM pedido_itens
          ORDER BY pedido_itens.pedido_id, pedido_itens.cod_terceiro, pedido_itens.ingested_at DESC NULLS LAST
        ), qtd_itens AS (
         SELECT itens_dedup.pedido_id,
            count(*) AS n
           FROM itens_dedup
          GROUP BY itens_dedup.pedido_id
        ), cad_terc_dedup AS (
         SELECT DISTINCT ON (cadastro_terceiros.id_terceiro) cadastro_terceiros.id_terceiro,
            cadastro_terceiros.endereco,
            cadastro_terceiros.numero,
            cadastro_terceiros.complemento,
            cadastro_terceiros.bairro,
            cadastro_terceiros.municipio,
            cadastro_terceiros.uf,
            cadastro_terceiros.cep,
            cadastro_terceiros.telefone1,
            cadastro_terceiros.telefone2,
            cadastro_terceiros.email,
            cadastro_terceiros.dt_ultima_alteracao
           FROM cadastro_terceiros
          ORDER BY cadastro_terceiros.id_terceiro, cadastro_terceiros.dt_ultima_alteracao DESC NULLS LAST
        )
 SELECT p.id_entrega AS entrega,
    COALESCE(cl.nome_canal, p.canal_real) AS nome_canal_de_vendas,
    p.pedido_bseller AS ped_cliente,
    to_char(p.data_pedido, 'YYYY-MM-DD HH24:MI:SS') AS dt_emissao,
    to_char(p.data_prometida, 'DD/MM/YYYY') AS dt_prometida,
    p.pedido_externo AS ped_externo,
    p.cpf_cliente AS cpf,
    p.nome_cliente AS nome,
    p.cep_destino AS cep,
    p.cidade_destino AS cidade,
    p.uf_destino AS uf,
    p.fone_cliente AS fone,
    p.email_cliente AS email,
        CASE
            WHEN ((p.status)::text = 'Cancelado'::text) THEN 'Cancelado'::character varying
            WHEN ((ut.descricao)::text = ANY (ARRAY[('Devolucao Total'::character varying)::text, ('Devolucao Parcial'::character varying)::text, ('EM DEVOLUCAO'::character varying)::text, ('DEVOLUCAO'::character varying)::text])) THEN ut.descricao
            WHEN (((p.status)::text = 'Liquidado'::text) AND ((p.ponto)::text = 'Entregue ao Cliente'::text)) THEN p.ponto
            WHEN (ut.descricao IS NOT NULL) THEN ut.descricao
            ELSE p.ponto
        END AS status_da_entrega,
    to_char(ut.data_ocorrencia, 'DD/MM/YYYY HH24:MI:SS') AS dt_ult_ponto_controle,
    tm.nome AS transportadora,
    i.categoria AS nome_5,
    (i.id_item_bseller)::text AS item,
    i.descricao AS nome_do_produto,
    pi.cod_terceiro,
    pi.quantidade AS qtde_pedido,
    pi.preco_unit_venda AS preco_final,
    round(((p.frete)::numeric / (NULLIF(qi.n, 0))::numeric), 4) AS frete,
    pi.preco_unit_custo AS cmv,
        CASE p.filial_id
            WHEN 1 THEN 'Matriz'::text
            WHEN 2 THEN 'ES'::text
            WHEN 3 THEN 'SP'::text
            WHEN 4 THEN 'SC'::text
            ELSE NULL::text
        END AS filial,
    p.num_nf_saida AS nota,
    p.chave_nf_saida AS chave_acesso,
    NULL::text AS pedido_troca,
    pt.serie AS serie_nf,
    i.codigo_fornec AS codigo_fornecedor,
    ct.endereco AS endereco_rua,
    ct.numero AS endereco_numero,
    ct.complemento AS endereco_complemento,
    ct.bairro AS endereco_bairro,
    p.updated_at AS pedido_updated_at,
    p.ingested_at AS pedido_ingested_at,
    GREATEST(p.updated_at, ut.data_ocorrencia, ct.dt_ultima_alteracao) AS last_changed_at
   FROM ((((((((pedidos_dedup p
     LEFT JOIN canal_lookup cl ON (((cl.canal)::text = (p.canal_real)::text)))
     LEFT JOIN ult_tracking ut ON (((ut.pedido_bseller)::text = (p.id_entrega)::text)))
     LEFT JOIN pedido_timeline pt ON (((pt.pedido_bseller)::text = (p.id_entrega)::text)))
     LEFT JOIN itens_dedup pi ON ((pi.pedido_id = p.id)))
     LEFT JOIN qtd_itens qi ON ((qi.pedido_id = p.id)))
     LEFT JOIN itens i ON ((((i.cod_terceiro)::text = (pi.cod_terceiro)::text) AND (i.is_deleted = false))))
     LEFT JOIN transportadora_map tm ON (((tm.cnpj)::text = (p.id_transportadora)::text)))
     LEFT JOIN cad_terc_dedup ct ON (((ct.id_terceiro)::text = (p.cpf_cliente)::text)));
