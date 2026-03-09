/**
 * Constantes e textos padrão para atendimentos
 */

export const CATEGORIAS = [
  "Falha Produção",
  "Falha Compras",
  "Falha de Compras", 
  "Falha Transporte",
  "Falha Fornecedor",
  "Falha Integração",
  "Falha de Integração",
  "Falha Parceiro",
  "Falha Cadastro",
  "Produto com Avaria",
  "Arrependimento",
  "Acompanhamento",
  "Comprovante de Entrega",
  "Impossibilidade Entrega",
  "Reclame Aqui",
  "Assistência Técnica"
];

export const ATENDENTES = ["Letícia Martelo", "Adnéia Campos"];

export const MOTIVOS_PENDENCIA = [
  "Ag. Compras",
  "Ag. Logística", 
  "Enviado",
  "Ag. Bseller",
  "Ag. Barrar",
  "Aguardando",
  "Em devolução",
  "Ag. Confirmação de Entrega",
  "Ag. Parceiro",
  "Ag. Transportadora",
  "Entregue",
  "Estornado",
  "Atendido",
  "Devolvido"
];

export const MOTIVOS_FINALIZADORES = ["Entregue", "Estornado", "Atendido", "Em devolução", "Devolvido"];

// Textos de Motivo da Pendência
export const TEXTOS_MOTIVO_PENDENCIA = {
  "Ag. Confirmação de Entrega": `Prezado(a) Sr(a). [PRIMEIRO_NOME]

Estamos entrando em contato para confirmar o recebimento do seu pedido: [PRODUTO] ([ENTREGA]). Poderia, por gentileza, nos informar se o produto já foi entregue?

1 - Sim
2 - Não

Aguardamos sua resposta.

Atenciosamente,
[ASSINATURA]`,

  "Ag. Confirmação - Extravio": `Agradecemos pelo retorno e lamentamos pelo ocorrido.

Não recebemos a confirmação de entrega por parte da transportadora, e por isso consideramos o pedido extraviado.

Por gentileza, poderia confirmar o endereço de entrega e ponto de referencia para o reenvio?

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Ag. Confirmação - Reenvio": `Seguiremos com um novo envio do pedido. 

Solicitaremos prioridade na entrega.

Muito obrigada pelo retorno.

Atenciosamente,
Equipe de Atendimento Weconnect`,

  "Ag. Confirmação - Confirmado": `Agradecemos a confirmação.

Atenciosamente,
Equipe de Atendimento Weconnect`,

  "Ag. Parceiro - Estorno": `Olá, 

Pedido cancelado, por favor seguir com o estorno ao cliente e encerramento do chamado.

Seguimos a disposição.
Atenciosamente! 
[ASSINATURA]`,

  "Ag. Parceiro - Confirmação Encerramento": `Olá, 

Poderia confirmar se podemos proceder com o encerramento do chamado?

Seguimos a disposição.
Atenciosamente, 
[ASSINATURA]`,

  "Ag. Parceiro - Encerramento": `Olá, Bom dia.

Estamos seguindo com o encerramento do pedido como entregue.

Seguimos a disposição, caso haja qualquer necessidade dentro dos prazo de atuação.
Atenciosamente!
[ASSINATURA]`,

  "Em devolução - Ag. Devolução": `Olá, 

O pedido segue em processo de devolução, conforme link de rastreamento abaixo:

Rastreio: [CÓDIGO_REVERSA]

https://rastreamento.correios.com.br/app/index.php

Assim que o item der entrada em nosso galpão, daremos sequência a tratativa.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Em devolução - Liberar Estorno": `Olá,

Pedido em processo de devolução. Em caráter de exceção, por favor seguir com o estorno ao cliente.

Atenciosamente,
[ASSINATURA]`,

  "Em devolução - Confirmar Reenvio": `Bom dia!

Infelizmente, a transportadora direcionou o pedido para devolução, em razão de insucesso na entrega. No momento, o pedido encontra-se em retorno para o nosso galpão.

Lamentamos muito o ocorrido e os transtornos causados. Gostaríamos de saber se podemos prosseguir com um novo envio do produto assim que ele for recebido em nosso galpão.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Devolvido - Problema Transportadora": `Olá,

Lamentavelmente, o pedido está sendo devolvido ao nosso estoque devido a PROBLEMA OPERACIONAL da transportadora. Por gentileza, poderiam confirmar o endereço completo com ponto de referência para realização de um novo envio?

Nossas sinceras desculpas.

Seguimos a disposição.

Atenciosamente,

[ASSINATURA]`,

  "Devolvido - Cancelamento e Estorno": `Olá,

O pedido foi recebido em nosso galpão. Favor seguir com o cancelamento e estorno ao cliente.

Estamos à disposição para qualquer dúvida.

Atenciosamente,

[ASSINATURA]`,

  "Devolvido - Reenvio": `Olá,

Recebemos o pedido em nosso galpão e estamos providenciando o envio de um novo item ao cliente. Assim que possível, enviaremos o link de rastreamento.

Estamos à disposição para qualquer dúvida.

Atenciosamente,

[ASSINATURA]`
};

// Textos de Avaria
export const TEXTOS_AVARIA = {
  "Avaria - Necessário Evidência": `Olá, Boa tarde.

Para darmos continuidade à tratativa, solicitamos, por gentileza, o envio das seguintes evidências:

* Imagem da embalagem recebida;
* Foto da etiqueta entregue.
* Foto do produto (todos os ângulos)
* Foto ou vídeo que identifique a avaria

Ressaltamos que o prazo para acionar a transportadora é de 7 dias corridos após a entrega do produto avariado.

Estamos à disposição para quaisquer dúvidas e aguardamos seu retorno.
Atenciosamente,
[ASSINATURA]`,

  "Avaria - Transporte até R$250": `Olá, Boa tarde.

Informamos que iniciamos a preparação e o envio de um novo produto para o cliente.

Em caráter de exceção, não será necessário realizar a devolução do item avariado. Pedimos, por gentileza, que oriente o cliente quanto ao descarte adequado do produto.

Assim que possível, compartilharemos o link de rastreamento.

Permanecemos à disposição para qualquer dúvida.
Atenciosamente,
[ASSINATURA]`,

  "Avaria - Reversa": `Olá, Boa tarde.

Sentimos muito pelo ocorrido, poderia confirmar com o cliente se após a devolução seguiremos com reenvio ou cancelamento?

Referente a solicitação, segue os dados para realizar o retorno do produto em no máximo 10 dias.

Autorização de Postagem em Agência

Dados da Emissão:

Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor dever se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA 


*** Orientações importantes ***: 

* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto); 

* Sem indícios de uso, sem violação do lacre original do fabricante; 

* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios; 

* Acompanhado também dos acessórios/peças e manual do item. 

* O estorno somente será autorizado após as avaliações citadas acima. As informações do destinatário serão preenchidas na agência dos Correios de acordo com Código de Postagem. 

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`
};

// Textos de Falha Produção
export const TEXTOS_FALHA_PRODUCAO = {
  "Sem Rastreio": `Olá, Boa tarde.

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em separação para transportadora. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]`,

  "Com Rastreio - Total Express": `Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
https://totalconecta.totalexpress.com.br/rastreamento

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Com Rastreio - J&T Express": `Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]

https://www.jtexpress.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Com Rastreio - ASAP Log": `Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]

https://rastreio.asaplog.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`
};

// Textos de Falha Transporte
export const TEXTOS_FALHA_TRANSPORTE = {
  "Rastreio - Total Express": `Olá, Boa tarde.

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
https://totalconecta.totalexpress.com.br/rastreamento

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Rastreio - J&T Express": `Olá, Boa tarde.

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]
Previsão de entrega até dia [DATA_PREVISAO]

https://www.jtexpress.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Rastreio - ASAP Log": `Olá, Boa tarde.

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Acionado transportadora para seguir com a entrega com prioridade.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]
Previsão de entrega até dia [DATA_PREVISAO]

https://rastreio.asaplog.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Bloqueio da Entrega": `Olá, Boa tarde.

Acionamos a transportadora com o bloqueio de entrega. Poderia, por favor orientar o cliente que em caso de tentativa de entrega, recusar o recebimento.

Assim que entrar em devolução, entraremos em contato.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]`,

  "Extravio": `Olá, Boa tarde.

O pedido foi extraviado pela transportadora. Iniciamos a preparação para envio de um novo item ao cliente, assim que possível disponibilizaremos o link para rastreio.
Pedimos a gentileza de solicitar ao cliente que em caso de entrega nos acione para darmos as devidas tratativas.

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`
};

// Textos de Arrependimento
export const TEXTOS_ARREPENDIMENTO = {
  "1ª Reversa": `Olá, Boa tarde.

Sentimos muito pelo ocorrido, poderia confirmar com o cliente se após a devolução seguiremos com reenvio ou cancelamento?

Referente a solicitação, segue os dados para realizar o retorno do produto em no máximo 10 dias.

Autorização de Postagem em Agência

Dados da Emissão:

Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor dever se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA 

*** Orientações importantes ***: 

* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto); 
* Sem indícios de uso, sem violação do lacre original do fabricante; 
* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios; 
* Acompanhado também dos acessórios/peças e manual do item. 
* O estorno somente será autorizado após as avaliações citadas acima. As informações do destinatário serão preenchidas na agência dos Correios de acordo com Código de Postagem. 

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "2ª Reversa": `Olá, Boa tarde.

Referente a solicitação, segue os dados para realizar a segunda e ultima tentativa de retorno do produto em no máximo 7 dias.

Autorização de Postagem em Agência

Dados da Emissão:

Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor dever se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA 

*** Orientações importantes ***: 

* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto); 
* Sem indícios de uso, sem violação do lacre original do fabricante; 
* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios; 
* Acompanhado também dos acessórios/peças e manual do item. 
* O estorno somente será autorizado após as avaliações citadas acima. As informações do destinatário serão preenchidas na agência dos Correios de acordo com Código de Postagem. 

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Em Devolução - Sem Estorno": `Olá, Boa tarde.

O pedido encontra-se em processo de devolução. Assim que recebido em nosso galpão, retornaremos com o atendimento.

Atenciosamente,
[ASSINATURA]`,

  "Em Devolução - Com Estorno": `Olá, Boa tarde.

Pedido em processo de devolução. Em caráter de exceção, por favor seguir com o estorno ao cliente.

Atenciosamente,
[ASSINATURA]`,

  "Devolvido - Com Estorno": `Olá, Boa tarde.

O pedido foi recebido em nosso galpão. Favor seguir com o cancelamento e estorno ao cliente.

Estamos à disposição para qualquer dúvida.
Atenciosamente,
[ASSINATURA]`,

  "Devolvido - Com Reenvio": `Olá, Boa tarde.

Recebemos o pedido em nosso galpão e estamos providenciando o envio de um novo item ao cliente. Assim que possível, enviaremos o link de rastreamento.

Estamos à disposição para qualquer dúvida.
Atenciosamente,
[ASSINATURA]`
};

// Textos de Acompanhamento
export const TEXTOS_ACOMPANHAMENTO = {
  "Entregue - Possível Contestação": `Olá, 

Informamos que o pedido foi entregue em [DATA_ULTIMO_PONTO]. Por favor confirmar entrega junto ao cliente.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Podemos encerrar o atendimento?

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Entregue - Contestação Expirada": `Olá, 

Informamos que o pedido foi entregue em [DATA_ULTIMO_PONTO]. Encaminhamos em anexo o comprovante de entrega para sua conferência.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados a partir da data da entrega. Dessa forma, informamos que o prazo para solicitação de acareação já se encontra expirado.

Diante disso, prosseguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Sem Comprovante de Entrega": `Olá,

Solicitamos o comprovante de entrega assinado ou o início do processo de acareação da entrega. Assim que possível, encaminharemos as informações.

Pedimos, por gentileza, que, ao entrar em contato com a cliente, seja solicitado que nos informe caso o pedido seja entregue.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Em Processo - Total Express": `Olá, 

Pedido em processo de entrega, podendo ser entregue a qualquer momento. 

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
https://totalconecta.totalexpress.com.br/rastreamento
Previsão de entrega até dia [DATA_PREVISAO]

Seguimos a disposição. 
Atenciosamente, 
[ASSINATURA]`,

  "Em Processo - J&T Express": `Olá, 

Pedido em processo de entrega, podendo ser entregue a qualquer momento. 

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]
Previsão de entrega até dia [DATA_PREVISAO]

https://www.jtexpress.com.br/

Seguimos a disposição. 
Atenciosamente,
[ASSINATURA]`,

  "Em Processo - ASAP Log": `Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento. 

Acionado transportadora para seguir com a entrega com prioridade.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]
Previsão de entrega até dia [DATA_PREVISAO]

https://rastreio.asaplog.com.br/

Seguimos a disposição. 
Atenciosamente,
[ASSINATURA]`,

  "Cancelamento por Falta": `Olá, 

Infelizmente, durante a preparação do item [PRODUTO] ([ENTREGA]), identificamos uma avaria, o que nos levou a optar pelo cancelamento devido à indisponibilidade para reposição.

Poderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?

Atenciosamente, 
[ASSINATURA]`,

  "Ag. Compras": `Olá, 

O pedido encontra-se em preparação. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente! 
[ASSINATURA]`
};

// Textos de Reclame Aqui
export const TEXTOS_RECLAME_AQUI = {
  "Resposta Inicial": `Prezado(a) Sr(a). [NOME_CLIENTE],

Primeiramente, lamentamos muito pelo ocorrido.

Informamos que o atendimento para compras realizadas em nossa loja é conduzido diretamente pelos nossos parceiros. Nesse caso, o procedimento correto é acionar o canal de venda por meio do qual a compra foi efetuada, para apoio na tratativa da ocorrência.

No entanto, para agilizar a resolução do caso, entraremos em contato diretamente via WhatsApp, no número informado na nota fiscal, oferecendo o suporte necessário, além de acionarmos o parceiro responsável para dar continuidade às tratativas.

Continuamos à disposição para qualquer dúvida ou necessidade.

Atenciosamente,
Equipe de Atendimento Weconnect`,

  "Mensagem WhatsApp": `Prezado(a) Sr(a). [NOME_CLIENTE]

Fomos acionados via Reclame Aqui com a informação de que o produto adquirido ainda não foi entregue.

Identificamos que o pedido, 

Nossas sinceras desculpas pelo ocorrido. Estamos à disposição para resolver o caso o mais breve possível.

Atenciosamente,
Equipe de Atendimento Weconnect`,

  "Solicitar Encerramento": `Agradecemos a confirmação.

Por gentileza, poderia seguir com o encerramento da reclamação no Reclame Aqui?
Aproveitamos para agradecer, caso seja possível, a avaliação do nosso atendimento referente à tratativa da ocorrência.

Permanecemos à disposição.

Atenciosamente,
Equipe de Atendimento Weconnect`,

  "Após Avaliação": `Prezado(a) Sr(a). [NOME_CLIENTE],

Agradecemos o retorno e a sua sincera avaliação em relação ao nosso atendimento.

Permanecemos à disposição para quaisquer dúvidas ou solicitações.

Atenciosamente,
Equipe de Atendimento Weconnect`
};

// Textos de Assistência Técnica
export const TEXTOS_ASSISTENCIA = {
  "Oderço": `Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – ODERÇO
44 2101-1428

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]`,

  "Ventisol": `Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – VENTISOL
https://assistencia.ventisol.com.br/

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]`,

  "OEX": `Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – OEX 
reversa@newex.com.br

0800 887 0505 OU 11 973928421

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]`,

  "Hoopson": `Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – Hoopson

+55 21 3809-2001

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]`
};

// Utilitários para detecção automática
export const getCategoriaPorStatus = (statusPedido) => {
  if (!statusPedido) return { categoria: '', motivo: '' };
  
  const status = statusPedido.toLowerCase();
  
  if (status.includes('aguardando estoque') || status.includes('ag. estoque')) {
    return { categoria: 'Falha de Compras', motivo: 'Ag. Compras' };
  }
  
  if (status.includes('nf emitida') || status.includes('nf aprovada') || 
      status.includes('entregue à transportadora') || status.includes('entregue a transportadora')) {
    return { categoria: 'Falha Produção', motivo: 'Ag. Logística' };
  }
  
  if (status.includes('entregue') && !status.includes('transportadora')) {
    return { categoria: '', motivo: '' };
  }
  
  if (status.includes('trânsito') || status.includes('transito') || 
      status.includes('saiu para entrega') || status.includes('em rota') ||
      status.includes('tentativa') || status.includes('aguardando retirada')) {
    return { categoria: 'Falha Transporte', motivo: 'Enviado' };
  }
  
  return { categoria: '', motivo: '' };
};

export const getTransportadoraRastreio = (transportadora) => {
  if (!transportadora) return null;
  
  const transp = transportadora.toLowerCase();
  
  if (transp.includes('total') || transp.includes('tex')) {
    return 'Com Rastreio - Total Express';
  }
  if (transp.includes('j&t') || transp.includes('jt') || transp.includes('j t')) {
    return 'Com Rastreio - J&T Express';
  }
  if (transp.includes('asap') || transp.includes('logistica e solucoes') || transp.includes('logística e soluções')) {
    return 'Com Rastreio - ASAP Log';
  }
  
  return null;
};

export const getRastreioTransporte = (transportadora) => {
  if (!transportadora) return null;
  const transp = transportadora.toLowerCase();
  
  if (transp.includes('total') || transp.includes('tex')) {
    return 'Rastreio - Total Express';
  }
  if (transp.includes('j&t') || transp.includes('jt') || transp.includes('j t')) {
    return 'Rastreio - J&T Express';
  }
  if (transp.includes('asap') || transp.includes('logistica e solucoes') || transp.includes('logística e soluções')) {
    return 'Rastreio - ASAP Log';
  }
  if (transp.includes('correios') || transp.includes('sedex') || transp.includes('pac')) {
    return 'Rastreio - Correios';
  }
  return null;
};

export const getRastreioAcompanhamento = (transportadora) => {
  if (!transportadora) return null;
  const transp = transportadora.toLowerCase();
  
  if (transp.includes('total') || transp.includes('tex')) {
    return 'Em Processo - Total Express';
  }
  if (transp.includes('j&t') || transp.includes('jt') || transp.includes('j t')) {
    return 'Em Processo - J&T Express';
  }
  if (transp.includes('asap') || transp.includes('logistica e solucoes') || transp.includes('logística e soluções')) {
    return 'Em Processo - ASAP Log';
  }
  if (transp.includes('correios') || transp.includes('sedex') || transp.includes('pac')) {
    return 'Em Processo - Correios';
  }
  return null;
};
