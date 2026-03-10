/**
 * Utility to replace all placeholders in template texts
 */
export const replaceAllPlaceholders = (texto, context = {}) => {
  if (!texto) return '';

  const { user, formData, pedidoErp, codigoReversa, dataVencimentoReversa } = context;

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

  // [ENTREGA]
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

  // [CÓDIGO_RASTREIO]
  if (pedidoErp?.codigo_rastreio) {
    result = result.replace(/\[CÓDIGO_RASTREIO\]/g, pedidoErp.codigo_rastreio);
  }

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

  return result;
};
