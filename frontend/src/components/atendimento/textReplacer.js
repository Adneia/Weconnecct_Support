/**
 * Utility to replace all placeholders in template texts
 */
export const replaceAllPlaceholders = (texto, context = {}) => {
  if (!texto) return '';

  const { user, formData, pedidoErp, codigoReversa, dataVencimentoReversa, awbTotal, jmsJt } = context;

  let result = texto;

  // [ASSINATURA]
  const assinatura = user?.name || formData?.atendente;
  if (assinatura) {
    result = result.replace(/\[ASSINATURA\]/g, assinatura);
  }

  // [NOME_CLIENTE] and [NOME]
  if (pedidoErp?.nome_cliente) {
    result = result.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
    result = result.replace(/\[NOME\]/g, pedidoErp.nome_cliente);
    const primeiroNome = pedidoErp.nome_cliente.split(' ')[0];
    result = result.replace(/\[PRIMEIRO_NOME\]/g, primeiroNome);
  }

  // [PARCEIRO]
  if (formData?.parceiro) {
    result = result.replace(/\[PARCEIRO\]/g, formData.parceiro);
  }

  // [PRODUTO]
  if (pedidoErp?.produto) {
    result = result.replace(/\[PRODUTO\]/g, pedidoErp.produto);
  }

  // [ITENS_ENTREGA] — TODOS os itens da entrega (ex.: "Produto A, Produto B e Produto C")
  // Usado em entrega parcial. Fallback para o produto único quando a lista não veio.
  {
    const lista = Array.isArray(pedidoErp?.itens_entrega) && pedidoErp.itens_entrega.length
      ? pedidoErp.itens_entrega
      : (pedidoErp?.produto ? [pedidoErp.produto] : []);
    let itensTexto = '[ITENS DA ENTREGA]';
    if (lista.length === 1) {
      itensTexto = lista[0];
    } else if (lista.length > 1) {
      itensTexto = lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
    }
    result = result.replace(/\[ITENS_ENTREGA\]/g, itensTexto);
  }

  // [ENTREGA] — sempre o número da entrega (numero_pedido), em todos os canais.
  // (O pedido externo LLL-xxxxx da LL Loyalty NÃO deve ser usado aqui.)
  const entrega = pedidoErp?.numero_pedido || formData?.numero_pedido;
  if (entrega) {
    result = result.replace(/\[ENTREGA\]/g, entrega);
  }

  // [NOTA_FISCAL]
  if (pedidoErp?.nota_fiscal) {
    const nfLimpa = String(pedidoErp.nota_fiscal).split('.')[0];
    result = result.replace(/\[NOTA_FISCAL\]/g, nfLimpa);
  }

  // [CHAVE_ACESSO]
  if (pedidoErp?.chave_nota) {
    result = result.replace(/\[CHAVE_ACESSO\]/g, pedidoErp.chave_nota);
  }

  // [CÓDIGO_RASTREIO] — usa AWB da Base Total ou JMS da J&T como fallback quando não há rastreio no tabelão
  const codigoRastreio = pedidoErp?.codigo_rastreio || awbTotal?.awb || jmsJt?.jms || '';
  result = result.replace(/\[CÓDIGO_RASTREIO\]/g, codigoRastreio);

  // [DATA_ENTREGA] and [DATA_ULTIMO_PONTO]
  if (pedidoErp?.data_status) {
    let dataFormatada = pedidoErp.data_status;
    if (dataFormatada.includes(' ')) {
      dataFormatada = dataFormatada.split(' ')[0];
    }
    result = result.replace(/\[DATA_ENTREGA\]/g, dataFormatada);
    result = result.replace(/\[DATA_ULTIMO_PONTO\]/g, dataFormatada);
  }

  // [CÓDIGO_REVERSA]
  if (codigoReversa) {
    result = result.replace(/\[CÓDIGO_REVERSA\]/g, codigoReversa);
  }

  // [DATA_EMISSAO]
  const hoje = new Date();
  const dataEmissao = hoje.toLocaleDateString('pt-BR');
  result = result.replace(/\[DATA_EMISSAO\]/g, dataEmissao);

  // [DATA_VALIDADE]
  if (dataVencimentoReversa) {
    const dataValidade = new Date(dataVencimentoReversa + 'T00:00:00').toLocaleDateString('pt-BR');
    result = result.replace(/\[DATA_VALIDADE\]/g, dataValidade);
  }

  // [NUMERO_OCORRENCIA]
  if (formData?.solicitacao) {
    result = result.replace(/\[NUMERO_OCORRENCIA\]/g, formData.solicitacao);
  }

  // [TRANSPORTADORA]
  if (pedidoErp?.transportadora) {
    result = result.replace(/\[TRANSPORTADORA\]/g, pedidoErp.transportadora);
  }

  // [STATUS_BSELLER]
  if (pedidoErp?.status_pedido) {
    result = result.replace(/\[STATUS_BSELLER\]/g, pedidoErp.status_pedido);
  }

  return result;
};
