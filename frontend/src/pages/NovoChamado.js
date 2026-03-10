import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Search, Package, Truck, User, MapPin, 
  Phone, Mail, Calendar, ShoppingBag, Copy,
  FileText, Hash, Building, AlertCircle, CheckCircle,
  MessageSquare, RotateCcw, Warehouse, Plus, ChevronDown, ChevronUp
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIAS = [
  "Falha Produção",
  "Falha Compras",
  "Falha Transporte",
  "Falha Fornecedor",
  "Falha Integração",
  "Falha Parceiro",
  "Falha Cadastro",
  "Produto com Avaria",
  "Arrependimento",
  "Acompanhamento",
  "Comprovante de Entrega",
  "Reclame Aqui",
  "Assistência Técnica"
];

const ATENDENTES = ["Letícia Martelo", "Adnéia Campos"];

// Motivos de pendência
const MOTIVOS_PENDENCIA = [
  "Ag. Compras",
  "Ag. Logística", 
  "Ag. Cliente",
  "Enviado",
  "Ag. Bseller",
  "Ag. Barrar",
  "Aguardando",
  "Em devolução",
  "Ag. Confirmação de Entrega",
  "Ag. Parceiro",
  "Ag. Transportadora",
  // --- Motivos que finalizam o atendimento ---
  "Entregue",
  "Estornado",
  "Atendido",
  "Devolvido"
];

// Motivos que permitem encerrar o atendimento
const MOTIVOS_FINALIZADORES = ["Entregue", "Estornado", "Atendido", "Em devolução", "Devolvido"];

// Textos para Motivo da Pendência
const TEXTOS_MOTIVO_PENDENCIA = {
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

[ASSINATURA]`,

  "Aguardando - Encerramento": `Olá, 

Poderia confirmar se podemos proceder com o encerramento do chamado?

Seguimos a disposição.

Atenciosamente, 

[ASSINATURA]`,

  "Aguardando - Prazo Expirado": `Olá, 

O código de postagem está expirado e não houve postagem do produto. Podemos seguir com o encerramento do atendimento?

Seguimos à disposição.

Atenciosamente, 

[ASSINATURA]`,

  "Aguardando - Próximo de Vencer": `Olá,

Objeto não postado até o momento. Por favor orientar o cliente em relação ao prazo que expira em [DATA_VALIDADE].

Seguimos a disposição.

Atenciosamente!

[ASSINATURA]`,

  "Aguardando - Encerrado": `Olá, Bom dia.

Estamos seguindo com o encerramento do pedido como entregue.

Seguimos a disposição, caso haja qualquer necessidade dentro dos prazo de atuação.

Atenciosamente!

[ASSINATURA]`,

  "Entregue - Encerramento": `Olá,

Poderia confirmar se podemos proceder com o encerramento do chamado?

Seguimos a disposição.

Atenciosamente,

[ASSINATURA]`,

  "Entregue - Prazo Expirado": `Olá,

O código de postagem está expirado e não houve postagem do produto. Podemos seguir com o encerramento do atendimento?

Seguimos à disposição.

Atenciosamente,

[ASSINATURA]`,

  "Entregue - Próximo de Vencer": `Olá,

Objeto não postado até o momento. Por favor orientar o cliente em relação ao prazo que expira em [DATA_VALIDADE].

Seguimos a disposição.

Atenciosamente!

[ASSINATURA]`,

  "Entregue - Encerrado": `Olá, Bom dia.

Estamos seguindo com o encerramento do pedido como entregue.

Seguimos a disposição, caso haja qualquer necessidade dentro dos prazo de atuação.

Atenciosamente!

[ASSINATURA]`,

  "Entregue - Confirmação": `Prezado(a) Sr(a). [NOME_CLIENTE]

Estamos entrando em contato para confirmar o recebimento do seu pedido: [PRODUTO] ([NUMERO_PEDIDO]). Poderia, por gentileza, nos informar se o produto já foi entregue?

1 - Sim
2 - Não

Aguardamos sua resposta.

Atenciosamente,
Equipe de Atendimento Weconnect`
};

// Função para detectar categoria e motivo baseado no status do pedido
const getCategoriaPorStatus = (statusPedido) => {
  if (!statusPedido) return { categoria: '', motivo: '' };
  
  const status = statusPedido.toLowerCase();
  
  // PRIMEIRO: Verificar se contém "entregue" (qualquer case)
  // "ENTREGUE", "Pedido Entregue", "Entregue ao cliente" -> motivo "Entregue"
  if (/\bentregue\b/.test(status) && !status.includes('transportadora')) {
    return { categoria: '', motivo: 'Entregue' };
  }
  
  // Aguardando estoque
  if (status.includes('aguardando estoque') || status.includes('ag. estoque')) {
    return { categoria: 'Falha Compras', motivo: 'Ag. Compras' };
  }
  
  // NF emitida, NF Aprovada, Entregue à transportadora
  if (status.includes('nf emitida') || status.includes('nf aprovada') || 
      status.includes('entregue à transportadora') || status.includes('entregue a transportadora')) {
    return { categoria: 'Falha Produção', motivo: 'Ag. Logística' };
  }
  
  // REGRA: Se o status estiver TODO em MAIÚSCULAS, é "Enviado"
  // (já excluímos "ENTREGUE" acima)
  const apenasLetras = statusPedido.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (apenasLetras.length > 0 && apenasLetras === apenasLetras.toUpperCase()) {
    return { categoria: 'Falha Transporte', motivo: 'Enviado' };
  }
  
  // Em trânsito, saiu para entrega, transferência, etc
  if (status.includes('trânsito') || status.includes('transito') || 
      status.includes('transferencia') || status.includes('transferência') ||
      status.includes('saiu para entrega') || status.includes('em rota') ||
      status.includes('tentativa') || status.includes('aguardando retirada')) {
    return { categoria: 'Falha Transporte', motivo: 'Enviado' };
  }
  
  return { categoria: '', motivo: '' };
};

// Função para detectar transportadora e retornar tipo de rastreio
const getTransportadoraRastreio = (transportadora) => {
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

// Textos de Avaria organizados
const TEXTOS_AVARIA = {
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
const TEXTOS_FALHA_PRODUCAO = {
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
const TEXTOS_FALHA_TRANSPORTE = {
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

  "Rastreio - Correios": `Olá, Boa tarde.

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue link para rastreio:
https://rastreamento.correios.com.br/app/index.php
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Bloqueio da Entrega": `Olá, Boa tarde.

Acionamos a transportadora com o bloqueio de entrega. Poderia, por favor orientar o cliente que em caso de tentativa de entrega, recusar o recebimento.

Assim que entrar em devolução, entraremos em contato.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]`,

  "Não é Possível Bloqueio": `Olá, Boa tarde.

Acionamos a transportadora com a solicitação de bloqueio da entrega. No entanto, identificamos que o pedido encontra-se em rota de entrega, o que significa que pode não ser possível impedir a entrega a tempo.

Por gentileza, oriente o cliente a recusar o recebimento, caso a tentativa de entrega ocorra.

Caso a entrega seja concluída, nos acionar novamente para que possamos seguir com a emissão da reversa para devolução do pedido.

Assim que o pedido retornar ao nosso centro de distribuição, entraremos em contato.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Extravio": `Olá, Boa tarde.

O pedido foi extraviado pela transportadora. Iniciamos a preparação para envio de um novo item ao cliente, assim que possível disponibilizaremos o link para rastreio.
Pedimos a gentileza de solicitar ao cliente que em caso de entrega nos acione para darmos as devidas tratativas.

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Extravio com Previsão": `Olá, Boa tarde.

O pedido foi extraviado pela transportadora, iniciamos uma nova preparação para envio ao cliente. A previsão atual de entrega é para o dia [DATA_PREVISAO]. Poderia, por gentileza, confirmar junto ao cliente a nova previsão?

Pedimos a gentileza de solicitar ao cliente que em caso de entrega nos acione para darmos as devidas tratativas.

Atenciosamente,
[ASSINATURA]`,

  "Extravio com Cancelamento": `Olá, Bom dia.

Informamos que o item [PRODUTO] ([ENTREGA]) foi extraviado pela transportadora. Pedimos a gentileza de seguir com o cancelamento e estorno devido a indisponibilidade de reposição.

Pedimos sinceras desculpas pelo ocorrido.

Atenciosamente,
[ASSINATURA]`,

  "Falta Comprovante": `Olá, Boa tarde.

Solicitamos o comprovante de entrega assinado ou o início do processo de acareação da entrega. Assim que possível, encaminharemos as informações.

Pedimos, por gentileza, que, ao entrar em contato com a cliente, seja solicitado que nos informe caso o pedido seja entregue.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Desconhece Entrega - No Prazo": `Olá, Boa tarde.

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Por favor confirmar entrega junto ao cliente.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Podemos encerrar o atendimento?

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Desconhece Entrega - Fora Prazo": `Olá, Boa tarde.

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Encaminhamos em anexo o comprovante de entrega para sua conferência.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados a partir da data da entrega. Dessa forma, informamos que o prazo para solicitação de acareação já se encontra expirado.

Diante disso, prosseguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "CSU - Comprovante Email": `Olá, Boa tarde.

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Por favor confirmar entrega junto ao cliente e seguir com o encerramento do chamado. Comprovante enviado via e-mail.

Assunto: Ocorrência: [NUMERO_OCORRENCIA]

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`
};

// Textos de Arrependimento
const TEXTOS_ARREPENDIMENTO = {
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
[ASSINATURA]`,

  "Reversa Expirada": `Olá, Boa tarde.

O código de postagem está expirado e não houve postagem do produto. Podemos seguir com o encerramento do atendimento?

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Reversa Irá Vencer": `Olá, Boa tarde.

Objeto não postado até o momento. Por favor orientar o cliente em relação ao prazo que expira em [DATA_VALIDADE].

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]`,

  "Bloqueio da Entrega": `Olá, Boa tarde.

Acionamos a transportadora com o bloqueio de entrega. Poderia, por favor orientar o cliente que em caso de tentativa de entrega, recusar o recebimento.

Assim que entrar em devolução, entraremos em contato.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]`,

  "Enviado Sem Bloqueio": `Olá, Boa tarde.

Acionamos a transportadora com a solicitação de bloqueio da entrega. No entanto, identificamos que o pedido encontra-se em rota de entrega, o que significa que pode não ser possível impedir a entrega a tempo.

Por gentileza, oriente o cliente a recusar o recebimento, caso a tentativa de entrega ocorra.

Caso a entrega seja concluída, nos acionar novamente para que possamos seguir com a emissão da reversa para devolução do pedido.

Assim que o pedido retornar ao nosso centro de distribuição, entraremos em contato.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Em Separação": `Olá, Boa tarde.

O pedido está em processo de separação pela transportadora, aguardando a confirmação da solicitação de barragem.

Prazo para retorno até 3 dias uteis. Assim que tivermos o retorno, entraremos em contato.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Impossibilidade Coleta": `Olá, Boa tarde.

Informamos que, no momento, não disponibilizamos o serviço de coleta. Sendo assim, é necessário que a cliente se dirija até a agência dos Correios mais próxima para realizar a postagem do item, possibilitando a continuidade da tratativa.

Permanecemos à disposição para quaisquer dúvidas.
Atenciosamente,
[ASSINATURA]`,

  "Prazo Expirado": `Olá, Boa tarde.

Informamos que o prazo para devolução do produto expirou. Dessa forma, não será possível dar continuidade à tratativa de devolução.

Permanecemos à disposição para quaisquer dúvidas.
Atenciosamente,
[ASSINATURA]`
};

// Textos de Acompanhamento
const TEXTOS_ACOMPANHAMENTO = {
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

  "Em Processo - Correios": `Olá, 

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue link para rastreio:
https://rastreamento.correios.com.br/app/index.php
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Cancelamento por Falta": `Olá, 

Infelizmente, durante a preparação do item [PRODUTO] ([ENTREGA]), identificamos uma avaria, o que nos levou a optar pelo cancelamento devido à indisponibilidade para reposição.

Poderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?

Atenciosamente, 
[ASSINATURA]`,

  "Falha de Integração": `Olá,

Não fomos acionamos pela Vtex para preparação deste pedido. Status Vtex (Aguardando autorização para despachar).

Por favor verificar o ocorrido entre Vtex e ...

Seguimos a disposição. 
Atenciosamente,
[ASSINATURA]`,

  "Ag. Compras": `Olá, 

O pedido encontra-se em preparação. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente! 
[ASSINATURA]`,

  "Problema na Emissão da NF": `Olá,

Infelizmente na emissão da Nota fiscal do pedido acima [ENTREGA] - [PRODUTO], foi constatado um problema fiscal por parte do CNPJ informado o qual impede a aprovação da NF. Poderiam seguir com o cancelamento e estorno ao cliente.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]`
};

// Textos de Reclame Aqui
const TEXTOS_RECLAME_AQUI = {
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
const TEXTOS_ASSISTENCIA = {
  "Oderço": `Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – ODERÇO
📞 44 2101-1428

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

📞 0800 887 0505 OU 11 973928421

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]`,

  "Hoopson": `Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – Hoopson

📞 0+55 21 3809-2001

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]`,

  "Ventisol + Reversa": `Olá, 

Este fornecedor tem a possibilidade de troca direto com ele, o cliente pode aciona-lo direto através do https://assistencia.ventisol.com.br/

Como estamos dentro do prazo de devolução, o cliente também pode optar pelo troca aqui na loja, para isso, basta realizar a devolução conforme o código de postagem abaixo e assim que for recebido em nosso galpão será enviado outro em substituição.

Segue os dados para realizar o retorno do produto em no máximo 10 dias.

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
Atenciosamente!`,

  "OEX + Reversa": `Olá, 

Este fornecedor tem a possibilidade de troca direto com ele, o cliente pode aciona-lo direto através do Serviço de Atendimento ao Cliente (SAC) – OEX - reversa@newex.com.br - 📞 0800 887 0505 OU 11 973928421 . 

Como estamos dentro do prazo de devolução, o cliente também pode optar pela devolução ou troca aqui na loja, para isso, basta realizar a devolução conforme o código de postagem abaixo e assim que for recebido em nosso galpão seguiremos com a tratativa

Segue os dados para realizar o retorno do produto em no máximo 10 dias.

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
Atenciosamente!

[ASSINATURA]`
};

// Texto para Falha de Integração
const TEXTO_FALHA_INTEGRACAO = `Olá,

Não fomos acionados pela Vtex para preparação deste pedido. Status Vtex (Aguardando autorização para despachar).

Por favor verificar o ocorrido entre Vtex e [PARCEIRO].

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`;

const NovoAtendimento = () => {
  const { id: atendimentoId } = useParams(); // ID do atendimento para edição
  const isEditMode = !!atendimentoId;
  const location = useLocation();
  
  // Pegar filtros da query string para preservar ao voltar
  const searchParams = new URLSearchParams(location.search);
  const filterParam = searchParams.get('filter'); // 'retornar' ou 'verificar'
  
  const [loading, setLoading] = useState(false);
  const [loadingAtendimento, setLoadingAtendimento] = useState(false);
  const [searchingPedido, setSearchingPedido] = useState(false);
  const [pedidoNotFound, setPedidoNotFound] = useState(false);
  const [modoFalhaIntegracao, setModoFalhaIntegracao] = useState(false);
  const [pedidoErp, setPedidoErp] = useState(null);
  const [anotacoesOriginais, setAnotacoesOriginais] = useState('');
  const [pedidosList, setPedidosList] = useState([]);
  const [showPedidosDialog, setShowPedidosDialog] = useState(false);
  const [showTextoDialog, setShowTextoDialog] = useState(false);
  const [textoPadrao, setTextoPadrao] = useState('');
  const [codigoReversa, setCodigoReversa] = useState('');
  const [atendimentoOriginal, setAtendimentoOriginal] = useState(null);
  
  // Data de vencimento da reversa - inicializa com hoje +10 dias
  const getDefaultVencimento = () => {
    const date = new Date();
    date.setDate(date.getDate() + 10);
    return date.toISOString().split('T')[0];
  };
  const [dataVencimentoReversa, setDataVencimentoReversa] = useState(getDefaultVencimento());
  
  const [searchType, setSearchType] = useState('pedido'); // 'pedido', 'cpf', 'nome', 'entrega', 'galpao'
  const [selectedGalpao, setSelectedGalpao] = useState('SP'); // SC, SP, ES
  const [searchValue, setSearchValue] = useState('');
  const [selectedAvaria, setSelectedAvaria] = useState('');
  const [selectedFalhaProducao, setSelectedFalhaProducao] = useState('');
  const [selectedFalhaTransporte, setSelectedFalhaTransporte] = useState('');
  const [selectedFalhaFornecedor, setSelectedFalhaFornecedor] = useState('');
  const [selectedArrependimento, setSelectedArrependimento] = useState('');
  const [selectedAcompanhamento, setSelectedAcompanhamento] = useState('');
  const [selectedReclameAqui, setSelectedReclameAqui] = useState('');
  const [selectedAssistencia, setSelectedAssistencia] = useState('');
  const [selectedComprovante, setSelectedComprovante] = useState('');
  const [selectedMotivoPendencia, setSelectedMotivoPendencia] = useState('');
  const [motivoPendencia, setMotivoPendencia] = useState('');
  const [transportadoraDetectada, setTransportadoraDetectada] = useState(null);
  const [retornarChamado, setRetornarChamado] = useState(false);
  const [verificarAdneia, setVerificarAdneia] = useState(false);
  const [encerrarAoCriar, setEncerrarAoCriar] = useState(false);
  const [pedidoExpanded, setPedidoExpanded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    solicitacao: false,
    categoria: false,
    motivo: false,
    motivoPendencia: false,
    anotacoes: false
  });
  const [showDevolucaoDialog, setShowDevolucaoDialog] = useState(false);
  const [devolucaoRegistrada, setDevolucaoRegistrada] = useState(false);
  const [existingAtendimento, setExistingAtendimento] = useState(null);
  const [showExistingDialog, setShowExistingDialog] = useState(false);
  const [categoriaInicial, setCategoriaInicial] = useState('');
  const [statusDevolucao, setStatusDevolucao] = useState(''); // Aguardando, Estornado, Reenviado
  const [showStatusDevolucaoDialog, setShowStatusDevolucaoDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);
  
  const [formData, setFormData] = useState({
    numero_pedido: '',
    solicitacao: '',
    parceiro: '',
    categoria: '',
    categoria_inicial: '',
    motivo: '',
    anotacoes: '',
    atendente: '' // Será preenchido automaticamente pelo useEffect
  });

  const navigate = useNavigate();
  const { getAuthHeader, user } = useAuth();
  
  // Atualizar atendente automaticamente quando o usuário logado mudar
  useEffect(() => {
    if (user?.name && !isEditMode) {
      setFormData(prev => ({ ...prev, atendente: user.name }));
    }
  }, [user, isEditMode]);

  // Busca automática com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue.trim().length >= 3) {
        if (searchType === 'entrega') {
          searchByEntrega(searchValue.trim());
        } else if (searchType === 'cpf') {
          searchByCpf(searchValue.trim());
        } else if (searchType === 'nome') {
          searchByNome(searchValue.trim());
        } else if (searchType === 'pedido') {
          searchByPedido(searchValue.trim());
        } else if (searchType === 'galpao') {
          searchByGalpaoNota(selectedGalpao, searchValue.trim());
        }
      } else {
        setPedidoErp(null);
        setPedidosList([]);
        setPedidoNotFound(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue, searchType, selectedGalpao]);

  // Carregar atendimento existente no modo de edição
  useEffect(() => {
    if (isEditMode && atendimentoId) {
      loadAtendimento(atendimentoId);
    }
  }, [atendimentoId, isEditMode]);

  const loadAtendimento = async (id) => {
    setLoadingAtendimento(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/chamados/${id}`,
        { headers: getAuthHeader() }
      );
      const atd = response.data;
      setAtendimentoOriginal(atd);
      
      // Preencher formulário com dados do atendimento
      setFormData({
        numero_pedido: atd.numero_pedido || '',
        solicitacao: atd.solicitacao || '',
        parceiro: atd.parceiro || atd.canal_vendas || '',
        categoria: atd.categoria || '',
        categoria_inicial: atd.categoria_inicial || atd.categoria || '',
        motivo: atd.motivo || '',
        anotacoes: atd.anotacoes || '',
        atendente: atd.atendente || 'Letícia Martelo',
        pendente: atd.pendente !== undefined ? atd.pendente : true
      });
      
      // Salvar anotações originais para comparação
      setAnotacoesOriginais(atd.anotacoes || '');
      
      // Preencher motivo da pendência
      if (atd.motivo_pendencia) {
        setMotivoPendencia(atd.motivo_pendencia);
      }
      
      // Preencher dados da reversa
      if (atd.reversa_codigo || atd.codigo_reversa) {
        setCodigoReversa(atd.reversa_codigo || atd.codigo_reversa);
      }
      if (atd.data_vencimento_reversa) {
        // Converter formato "16/3" para "2026-03-16" se necessário
        let dataVenc = atd.data_vencimento_reversa;
        if (dataVenc && dataVenc.includes('/') && !dataVenc.includes('-')) {
          const parts = dataVenc.split('/');
          if (parts.length === 2) {
            const dia = parts[0].padStart(2, '0');
            const mes = parts[1].padStart(2, '0');
            dataVenc = `2026-${mes}-${dia}`;
          }
        }
        setDataVencimentoReversa(dataVenc);
      }
      
      // Carregar retornar_chamado
      if (atd.retornar_chamado !== undefined) {
        setRetornarChamado(atd.retornar_chamado);
      }
      
      // Carregar verificar_adneia
      if (atd.verificar_adneia !== undefined) {
        setVerificarAdneia(atd.verificar_adneia);
      }
      
      // Carregar status_devolucao se existir
      if (atd.status_devolucao) {
        setStatusDevolucao(atd.status_devolucao);
      }
      
      // Buscar dados do pedido ERP
      if (atd.numero_pedido) {
        setSearchValue(atd.numero_pedido);
        setSearchType('entrega');
        try {
          const pedidoResponse = await axios.get(
            `${API_URL}/api/pedidos/${atd.numero_pedido}`,
            { headers: getAuthHeader() }
          );
          if (pedidoResponse.data) {
            setPedidoErp(pedidoResponse.data);
            const transpRastreio = getTransportadoraRastreio(pedidoResponse.data.transportadora);
            setTransportadoraDetectada(transpRastreio);
          }
        } catch (e) {
          console.log('Pedido ERP não encontrado');
        }
      }
      
      toast.success('Atendimento carregado');
    } catch (error) {
      console.error('Erro ao carregar atendimento:', error);
      toast.error('Erro ao carregar atendimento');
    } finally {
      setLoadingAtendimento(false);
    }
  };

  // Função para processar pedido e auto-preencher campos
  const processarPedido = async (pedido) => {
    // Verificar se já existe atendimento para esta entrega (somente em modo novo)
    if (!isEditMode) {
      try {
        const response = await axios.get(
          `${API_URL}/api/chamados?search=${pedido.numero_pedido}&search_type=entrega`,
          { headers: getAuthHeader() }
        );
        if (response.data && response.data.length > 0) {
          // Encontrou atendimentos existentes
          setExistingAtendimento(response.data[0]);
          setShowExistingDialog(true);
        }
      } catch (error) {
        console.error('Erro ao verificar atendimentos existentes:', error);
      }
    }
    
    setPedidoErp(pedido);
    
    // Auto-detectar categoria e motivo baseado no status
    const { categoria, motivo } = getCategoriaPorStatus(pedido.status_pedido);
    
    // Auto-detectar transportadora
    const transpRastreio = getTransportadoraRastreio(pedido.transportadora);
    setTransportadoraDetectada(transpRastreio);
    
    // Atualizar formulário
    setFormData(prev => ({ 
      ...prev, 
      numero_pedido: pedido.numero_pedido,
      parceiro: pedido.canal_vendas || '',
      categoria: categoria || prev.categoria
    }));
    
    // Salvar a categoria inicial detectada (para referência)
    if (categoria && !categoriaInicial) {
      setCategoriaInicial(categoria);
    }
    
    // Atualizar motivo de pendência
    if (motivo) {
      setMotivoPendencia(motivo);
    }
    
    // Se detectou transportadora e categoria é Falha Produção, auto-selecionar
    if (transpRastreio && categoria === 'Falha Produção') {
      setSelectedFalhaProducao(transpRastreio);
    }
  };

  const searchByEntrega = async (entrega) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/${entrega}`,
        { headers: getAuthHeader() }
      );
      processarPedido(response.data);
      setPedidoNotFound(false);
    } catch (error) {
      if (error.response?.status === 404) {
        setPedidoNotFound(true);
      } else {
        toast.error('Erro ao buscar pedido');
      }
    } finally {
      setSearchingPedido(false);
    }
  };

  const searchByCpf = async (cpf) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidosList([]);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/buscar/cpf/${cpf}`,
        { headers: getAuthHeader() }
      );
      
      if (response.data.length === 0) {
        setPedidoNotFound(true);
      } else if (response.data.length === 1) {
        processarPedido(response.data[0]);
      } else {
        setPedidosList(response.data);
        setShowPedidosDialog(true);
      }
    } catch (error) {
      toast.error('Erro ao buscar por CPF');
    } finally {
      setSearchingPedido(false);
    }
  };

  const searchByNome = async (nome) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidosList([]);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/buscar/nome/${encodeURIComponent(nome)}`,
        { headers: getAuthHeader() }
      );
      
      if (response.data.length === 0) {
        setPedidoNotFound(true);
      } else if (response.data.length === 1) {
        processarPedido(response.data[0]);
      } else {
        setPedidosList(response.data);
        setShowPedidosDialog(true);
      }
    } catch (error) {
      toast.error('Erro ao buscar por nome');
    } finally {
      setSearchingPedido(false);
    }
  };

  const searchByPedido = async (pedido) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidosList([]);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/buscar/pedido/${encodeURIComponent(pedido)}`,
        { headers: getAuthHeader() }
      );
      
      if (response.data.length === 0) {
        setPedidoNotFound(true);
      } else if (response.data.length === 1) {
        processarPedido(response.data[0]);
      } else {
        setPedidosList(response.data);
        setShowPedidosDialog(true);
      }
    } catch (error) {
      toast.error('Erro ao buscar por pedido');
    } finally {
      setSearchingPedido(false);
    }
  };

  const searchByNota = async (nota) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidosList([]);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/buscar/nota/${encodeURIComponent(nota)}`,
        { headers: getAuthHeader() }
      );
      
      if (response.data.length === 0) {
        setPedidoNotFound(true);
      } else if (response.data.length === 1) {
        processarPedido(response.data[0]);
      } else {
        setPedidosList(response.data);
        setShowPedidosDialog(true);
      }
    } catch (error) {
      toast.error('Erro ao buscar por nota');
    } finally {
      setSearchingPedido(false);
    }
  };

  const searchByGalpaoNota = async (galpao, nota) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidosList([]);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/buscar/galpao/${encodeURIComponent(galpao)}/nota/${encodeURIComponent(nota)}`,
        { headers: getAuthHeader() }
      );
      
      if (response.data.length === 0) {
        setPedidoNotFound(true);
      } else if (response.data.length === 1) {
        processarPedido(response.data[0]);
      } else {
        setPedidosList(response.data);
        setShowPedidosDialog(true);
      }
    } catch (error) {
      toast.error('Erro ao buscar por galpão/nota');
    } finally {
      setSearchingPedido(false);
    }
  };

  const selectPedido = (pedido) => {
    processarPedido(pedido);
    setShowPedidosDialog(false);
  };

  const loadTextoPadrao = async (categoria) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/textos-padroes/${encodeURIComponent(categoria)}`,
        { headers: getAuthHeader() }
      );
      // Substituir todos os placeholders disponíveis
      let texto = response.data.texto;
      
      // [ASSINATURA] - nome do atendente logado
      if (user?.name || formData.atendente) {
        texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
      }
      
      // [NOME_CLIENTE] e [NOME] - nome completo do cliente
      if (pedidoErp?.nome_cliente) {
        texto = texto.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
        texto = texto.replace(/\[NOME\]/g, pedidoErp.nome_cliente);
        // [PRIMEIRO_NOME] - primeiro nome do cliente
        const primeiroNome = pedidoErp.nome_cliente.split(' ')[0];
        texto = texto.replace(/\[PRIMEIRO_NOME\]/g, primeiroNome);
      }
      
      // [PARCEIRO] - canal de vendas
      if (formData.parceiro) {
        texto = texto.replace(/\[PARCEIRO\]/g, formData.parceiro);
      }
      
      // [PRODUTO] - nome do produto
      if (pedidoErp?.produto) {
        texto = texto.replace(/\[PRODUTO\]/g, pedidoErp.produto);
      }
      
      // [ENTREGA] - número do pedido
      if (pedidoErp?.numero_pedido || formData.numero_pedido) {
        texto = texto.replace(/\[ENTREGA\]/g, pedidoErp?.numero_pedido || formData.numero_pedido);
      }
      
      // [NOTA_FISCAL] - número da NF (remove .0 se existir)
      if (pedidoErp?.nota_fiscal) {
        const nfLimpa = String(pedidoErp.nota_fiscal).split('.')[0];
        texto = texto.replace(/\[NOTA_FISCAL\]/g, nfLimpa);
      }
      
      // [CHAVE_ACESSO] - chave da nota fiscal
      if (pedidoErp?.chave_nota) {
        texto = texto.replace(/\[CHAVE_ACESSO\]/g, pedidoErp.chave_nota);
      }
      
      // [CÓDIGO_RASTREIO] - código de rastreio
      if (pedidoErp?.codigo_rastreio) {
        texto = texto.replace(/\[CÓDIGO_RASTREIO\]/g, pedidoErp.codigo_rastreio);
      }
      
      // [DATA_ULTIMO_PONTO] e [DATA_ENTREGA] - data do último status
      if (pedidoErp?.data_status) {
        let dataFormatada = pedidoErp.data_status;
        // Se tiver hora, pegar apenas a data
        if (dataFormatada.includes(' ')) {
          dataFormatada = dataFormatada.split(' ')[0];
        }
        texto = texto.replace(/\[DATA_ENTREGA\]/g, dataFormatada);
        texto = texto.replace(/\[DATA_ULTIMO_PONTO\]/g, dataFormatada);
      }
      
      // [CÓDIGO_REVERSA] - código da reversa (se preenchido)
      if (codigoReversa) {
        texto = texto.replace(/\[CÓDIGO_REVERSA\]/g, codigoReversa);
      }
      
      // [DATA_EMISSAO] - data de hoje
      const hoje = new Date();
      const dataEmissao = hoje.toLocaleDateString('pt-BR');
      texto = texto.replace(/\[DATA_EMISSAO\]/g, dataEmissao);
      
      // [DATA_VALIDADE] - data de vencimento da reversa
      if (dataVencimentoReversa) {
        const dataValidade = new Date(dataVencimentoReversa + 'T00:00:00').toLocaleDateString('pt-BR');
        texto = texto.replace(/\[DATA_VALIDADE\]/g, dataValidade);
      }
      
      // [NUMERO_OCORRENCIA] - número da solicitação/ocorrência do parceiro
      if (formData.solicitacao) {
        texto = texto.replace(/\[NUMERO_OCORRENCIA\]/g, formData.solicitacao);
      }
      
      setTextoPadrao(texto);
      setShowTextoDialog(true);
    } catch (error) {
      toast.error('Erro ao carregar texto padrão');
    }
  };

  const loadTextoAvaria = (tipoAvaria) => {
    let texto = TEXTOS_AVARIA[tipoAvaria] || '';
    // Substituir placeholders
    if (formData.atendente) {
      texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
    }
    if (pedidoErp?.nome_cliente) {
      texto = texto.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
    }
    // Dados da Reversa
    if (codigoReversa) {
      texto = texto.replace(/\[CÓDIGO_REVERSA\]/g, codigoReversa);
    }
    // Data de emissão (hoje)
    const hoje = new Date();
    const dataEmissao = hoje.toLocaleDateString('pt-BR');
    texto = texto.replace(/\[DATA_EMISSAO\]/g, dataEmissao);
    
    // Data de vencimento da reversa
    if (dataVencimentoReversa) {
      const dataValidade = new Date(dataVencimentoReversa + 'T00:00:00').toLocaleDateString('pt-BR');
      texto = texto.replace(/\[DATA_VALIDADE\]/g, dataValidade);
    }
    setTextoPadrao(texto);
    setSelectedAvaria(tipoAvaria);
    setShowTextoDialog(true);
  };

  const loadTextoFalhaProducao = (tipoFalha) => {
    let texto = TEXTOS_FALHA_PRODUCAO[tipoFalha] || '';
    // Substituir placeholders
    if (formData.atendente) {
      texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
    }
    if (pedidoErp?.nota_fiscal) {
      // Remover dígito após o ponto (ex: 10753.0 -> 10753)
      const nfLimpa = String(pedidoErp.nota_fiscal).split('.')[0];
      texto = texto.replace(/\[NOTA_FISCAL\]/g, nfLimpa);
    }
    if (pedidoErp?.chave_nota) {
      texto = texto.replace(/\[CHAVE_ACESSO\]/g, pedidoErp.chave_nota);
    }
    if (pedidoErp?.codigo_rastreio) {
      texto = texto.replace(/\[CÓDIGO_RASTREIO\]/g, pedidoErp.codigo_rastreio);
    }
    // Substituir entrega (número do pedido)
    if (pedidoErp?.numero_pedido) {
      texto = texto.replace(/\[ENTREGA\]/g, pedidoErp.numero_pedido);
    }
    setTextoPadrao(texto);
    setSelectedFalhaProducao(tipoFalha);
    setShowTextoDialog(true);
  };

  const loadTextoFalhaTransporte = (tipoFalha) => {
    let texto = TEXTOS_FALHA_TRANSPORTE[tipoFalha] || '';
    // Substituir placeholders
    if (formData.atendente) {
      texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
    }
    if (pedidoErp?.nota_fiscal) {
      // Remover dígito após o ponto (ex: 10753.0 -> 10753)
      const nfLimpa = String(pedidoErp.nota_fiscal).split('.')[0];
      texto = texto.replace(/\[NOTA_FISCAL\]/g, nfLimpa);
    }
    if (pedidoErp?.chave_nota) {
      texto = texto.replace(/\[CHAVE_ACESSO\]/g, pedidoErp.chave_nota);
    }
    if (pedidoErp?.codigo_rastreio) {
      texto = texto.replace(/\[CÓDIGO_RASTREIO\]/g, pedidoErp.codigo_rastreio);
    }
    // Substituir produto e entrega
    if (pedidoErp?.produto) {
      texto = texto.replace(/\[PRODUTO\]/g, pedidoErp.produto);
    }
    if (pedidoErp?.numero_pedido) {
      texto = texto.replace(/\[ENTREGA\]/g, pedidoErp.numero_pedido);
    }
    // Data de entrega (se disponível)
    if (pedidoErp?.data_entrega) {
      texto = texto.replace(/\[DATA_ENTREGA\]/g, pedidoErp.data_entrega);
    }
    setTextoPadrao(texto);
    setSelectedFalhaTransporte(tipoFalha);
    setShowTextoDialog(true);
  };

  // Função para obter o tipo de rastreio baseado na transportadora para Falha Transporte
  const getRastreioTransporte = () => {
    if (!pedidoErp?.transportadora) return null;
    const transp = pedidoErp.transportadora.toLowerCase();
    
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

  const loadTextoFalhaFornecedor = async (tipo) => {
    const textoKey = `Falha Fornecedor - ${tipo}`;
    try {
      const response = await axios.get(
        `${API_URL}/api/textos-padroes/${encodeURIComponent(textoKey)}`,
        { headers: getAuthHeader() }
      );
      let texto = response.data.texto;
      
      // Substituir placeholders
      if (user?.name || formData.atendente) {
        texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
      }
      if (pedidoErp?.nome_cliente) {
        texto = texto.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
      }
      if (codigoReversa) {
        texto = texto.replace(/\[CÓDIGO_REVERSA\]/g, codigoReversa);
      }
      // Data de emissão (hoje)
      const hoje = new Date();
      const dataEmissao = hoje.toLocaleDateString('pt-BR');
      texto = texto.replace(/\[DATA_EMISSAO\]/g, dataEmissao);
      
      // Data de vencimento da reversa
      if (dataVencimentoReversa) {
        const dataValidade = new Date(dataVencimentoReversa + 'T00:00:00').toLocaleDateString('pt-BR');
        texto = texto.replace(/\[DATA_VALIDADE\]/g, dataValidade);
      }
      
      setTextoPadrao(texto);
      setSelectedFalhaFornecedor(tipo);
      setShowTextoDialog(true);
    } catch (error) {
      toast.error('Erro ao carregar texto padrão');
    }
  };

  const loadTextoArrependimento = (tipo) => {
    let texto = TEXTOS_ARREPENDIMENTO[tipo] || '';
    // Substituir placeholders
    if (formData.atendente) {
      texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
    }
    if (pedidoErp?.nome_cliente) {
      texto = texto.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
    }
    if (codigoReversa) {
      texto = texto.replace(/\[CÓDIGO_REVERSA\]/g, codigoReversa);
    }
    // Data de emissão (hoje)
    const hoje = new Date();
    const dataEmissao = hoje.toLocaleDateString('pt-BR');
    texto = texto.replace(/\[DATA_EMISSAO\]/g, dataEmissao);
    
    // Data de vencimento da reversa
    if (dataVencimentoReversa) {
      const dataValidade = new Date(dataVencimentoReversa + 'T00:00:00').toLocaleDateString('pt-BR');
      texto = texto.replace(/\[DATA_VALIDADE\]/g, dataValidade);
    }
    
    setTextoPadrao(texto);
    setSelectedArrependimento(tipo);
    setShowTextoDialog(true);
  };

  const loadTextoAcompanhamento = (tipo) => {
    let texto = TEXTOS_ACOMPANHAMENTO[tipo] || '';
    // Substituir placeholders
    if (formData.atendente) {
      texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
    }
    if (pedidoErp?.nome_cliente) {
      texto = texto.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
    }
    if (pedidoErp?.nota_fiscal) {
      // Remover dígito após o ponto (ex: 10753.0 -> 10753)
      const nfLimpa = String(pedidoErp.nota_fiscal).split('.')[0];
      texto = texto.replace(/\[NOTA_FISCAL\]/g, nfLimpa);
    }
    if (pedidoErp?.chave_nota) {
      texto = texto.replace(/\[CHAVE_ACESSO\]/g, pedidoErp.chave_nota);
    }
    if (pedidoErp?.codigo_rastreio) {
      texto = texto.replace(/\[CÓDIGO_RASTREIO\]/g, pedidoErp.codigo_rastreio);
    }
    // Substituir produto e entrega
    if (pedidoErp?.produto) {
      texto = texto.replace(/\[PRODUTO\]/g, pedidoErp.produto);
    }
    if (pedidoErp?.numero_pedido) {
      texto = texto.replace(/\[ENTREGA\]/g, pedidoErp.numero_pedido);
    }
    // Data de entrega / Data do último ponto (formato DD/MM/AAAA)
    if (pedidoErp?.data_status) {
      // Converter para formato DD/MM/AAAA (pode vir como "14/04/2024 16:15:00" ou outro formato)
      let dataFormatada = pedidoErp.data_status;
      // Se tiver hora, pegar apenas a data
      if (dataFormatada.includes(' ')) {
        dataFormatada = dataFormatada.split(' ')[0];
      }
      texto = texto.replace(/\[DATA_ENTREGA\]/g, dataFormatada);
      texto = texto.replace(/\[DATA_ULTIMO_PONTO\]/g, dataFormatada);
    }
    setTextoPadrao(texto);
    setSelectedAcompanhamento(tipo);
    setShowTextoDialog(true);
  };

  // Função para obter o tipo de rastreio para Acompanhamento baseado na transportadora
  const getRastreioAcompanhamento = () => {
    if (!pedidoErp?.transportadora) return null;
    const transp = pedidoErp.transportadora.toLowerCase();
    
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

  const loadTextoReclameAqui = (tipo) => {
    let texto = TEXTOS_RECLAME_AQUI[tipo] || '';
    // Substituir nome do cliente (apenas primeiro nome)
    if (pedidoErp?.nome_cliente) {
      const primeiroNome = pedidoErp.nome_cliente.split(' ')[0];
      texto = texto.replace(/\[NOME_CLIENTE\]/g, primeiroNome);
    }
    setTextoPadrao(texto);
    setSelectedReclameAqui(tipo);
    setShowTextoDialog(true);
  };

  const loadTextoAssistencia = (tipo) => {
    let texto = TEXTOS_ASSISTENCIA[tipo] || '';
    // Substituir placeholders
    if (formData.atendente) {
      texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
    }
    if (pedidoErp?.nome_cliente) {
      texto = texto.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
    }
    // Código da reversa (se preenchido)
    if (codigoReversa) {
      texto = texto.replace(/\[CÓDIGO_REVERSA\]/g, codigoReversa);
    }
    // Data de emissão (hoje)
    const hoje = new Date();
    const dataEmissao = hoje.toLocaleDateString('pt-BR');
    texto = texto.replace(/\[DATA_EMISSAO\]/g, dataEmissao);
    
    // Data de validade da reversa
    if (dataVencimentoReversa) {
      const dataValidade = new Date(dataVencimentoReversa + 'T00:00:00').toLocaleDateString('pt-BR');
      texto = texto.replace(/\[DATA_VALIDADE\]/g, dataValidade);
    }
    
    setTextoPadrao(texto);
    setSelectedAssistencia(tipo);
    setShowTextoDialog(true);
  };

  const loadTextoComprovante = async (tipo) => {
    const textoKey = `Comprovante de Entrega - ${tipo}`;
    try {
      const response = await axios.get(
        `${API_URL}/api/textos-padroes/${encodeURIComponent(textoKey)}`,
        { headers: getAuthHeader() }
      );
      let texto = response.data.texto;
      
      // Substituir placeholders
      if (user?.name || formData.atendente) {
        texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
      }
      if (pedidoErp?.nome_cliente) {
        texto = texto.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
        const primeiroNome = pedidoErp.nome_cliente.split(' ')[0];
        texto = texto.replace(/\[PRIMEIRO_NOME\]/g, primeiroNome);
      }
      if (pedidoErp?.data_status) {
        let dataFormatada = pedidoErp.data_status;
        if (dataFormatada.includes(' ')) {
          dataFormatada = dataFormatada.split(' ')[0];
        }
        texto = texto.replace(/\[DATA_ULTIMO_PONTO\]/g, dataFormatada);
        texto = texto.replace(/\[DATA_ENTREGA\]/g, dataFormatada);
      }
      if (pedidoErp?.produto) {
        texto = texto.replace(/\[PRODUTO\]/g, pedidoErp.produto);
      }
      if (pedidoErp?.numero_pedido || formData.numero_pedido) {
        texto = texto.replace(/\[ENTREGA\]/g, pedidoErp?.numero_pedido || formData.numero_pedido);
      }
      if (formData.solicitacao) {
        texto = texto.replace(/\[NUMERO_OCORRENCIA\]/g, formData.solicitacao);
      }
      
      setTextoPadrao(texto);
      setSelectedComprovante(tipo);
      setShowTextoDialog(true);
    } catch (error) {
      toast.error('Erro ao carregar texto padrão');
    }
  };

  const loadTextoMotivoPendencia = (tipo) => {
    let texto = TEXTOS_MOTIVO_PENDENCIA[tipo] || '';
    // Substituir placeholders
    if (formData.atendente) {
      texto = texto.replace(/\[ASSINATURA\]/g, user?.name || formData.atendente);
    }
    if (pedidoErp?.nome_cliente) {
      const primeiroNome = pedidoErp.nome_cliente.split(' ')[0];
      texto = texto.replace(/\[PRIMEIRO_NOME\]/g, primeiroNome);
    }
    if (pedidoErp?.produto) {
      texto = texto.replace(/\[PRODUTO\]/g, pedidoErp.produto);
    }
    if (pedidoErp?.numero_pedido) {
      texto = texto.replace(/\[ENTREGA\]/g, pedidoErp.numero_pedido);
    }
    if (codigoReversa) {
      texto = texto.replace(/\[CÓDIGO_REVERSA\]/g, codigoReversa);
    }
    // [DATA_VALIDADE] - data de vencimento da reversa
    if (dataVencimentoReversa) {
      const dataValidade = new Date(dataVencimentoReversa + 'T00:00:00').toLocaleDateString('pt-BR');
      texto = texto.replace(/\[DATA_VALIDADE\]/g, dataValidade);
    }
    setTextoPadrao(texto);
    setSelectedMotivoPendencia(tipo);
    setShowTextoDialog(true);
  };

  const gerarCodigoReversa = async () => {
    if (!formData.numero_pedido) {
      toast.error('Selecione um pedido primeiro');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/api/gerar-reversa/${formData.numero_pedido}`,
        {},
        { headers: getAuthHeader() }
      );
      setCodigoReversa(response.data.codigo_reversa);
      toast.success(`Código gerado: ${response.data.codigo_reversa}`);
    } catch (error) {
      toast.error('Erro ao gerar código de reversa');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset errors
    setFieldErrors({
      solicitacao: false,
      categoria: false,
      motivo: false,
      motivoPendencia: false,
      anotacoes: false
    });
    
    // Validação de campos obrigatórios
    let hasError = false;
    const newErrors = { ...fieldErrors };
    
    if (!formData.numero_pedido.trim()) {
      toast.error('Busque e selecione um pedido');
      return;
    }
    if (!formData.solicitacao.trim()) {
      toast.error('Preencha o campo Solicitação');
      newErrors.solicitacao = true;
      hasError = true;
    }
    if (!formData.categoria) {
      toast.error('Selecione a categoria');
      newErrors.categoria = true;
      hasError = true;
    }
    if (!formData.motivo.trim()) {
      toast.error('Preencha o campo Motivo');
      newErrors.motivo = true;
      hasError = true;
    }
    if (!formData.anotacoes.trim()) {
      toast.error('Adicione uma anotação antes de salvar');
      newErrors.anotacoes = true;
      hasError = true;
    }
    
    // Se for edição, verificar se uma NOVA anotação foi adicionada
    // Se não foi, perguntar se deseja continuar
    if (isEditMode && formData.anotacoes.trim() === anotacoesOriginais.trim()) {
      const continuar = window.confirm('Você não adicionou uma nova anotação. Deseja continuar mesmo assim?');
      if (!continuar) {
        return;
      }
    }
    
    // Validação para encerrar ao criar
    if (!isEditMode && encerrarAoCriar && !MOTIVOS_FINALIZADORES.includes(motivoPendencia)) {
      toast.error(`Para encerrar, selecione um motivo finalizador: ${MOTIVOS_FINALIZADORES.join(', ')}`);
      return;
    }
    
    if (hasError) {
      setFieldErrors(newErrors);
      return;
    }

    // Verificar se é "Em devolução" ou "Devolvido" e precisa selecionar status de devolução
    const isDevolucao = motivoPendencia === 'Em devolução' || motivoPendencia === 'Devolvido';
    
    // Se é devolução, não tem status selecionado E ainda não registrou a devolução na planilha
    // Então precisa mostrar o fluxo de registro
    if (isDevolucao && !statusDevolucao && !devolucaoRegistrada) {
      // Guardar os dados para submeter depois
      setPendingSubmitData({ formData, motivoPendencia, codigoReversa, dataVencimentoReversa, retornarChamado, verificarAdneia, encerrarAoCriar });
      // Mostrar diálogo perguntando se quer registrar
      setShowDevolucaoDialog(true);
      return;
    }

    await submitAtendimento(formData, motivoPendencia, codigoReversa, dataVencimentoReversa, retornarChamado, verificarAdneia, encerrarAoCriar, statusDevolucao);
  };

  const submitAtendimento = async (formData, motivoPendencia, codigoReversa, dataVencimentoReversa, retornarChamado, verificarAdneia, encerrarAoCriar, statusDevolucaoParam) => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        atendente: user?.name || formData.atendente,
        motivo_pendencia: motivoPendencia || null,
        codigo_reversa: codigoReversa || null,
        data_vencimento_reversa: dataVencimentoReversa || null,
        retornar_chamado: retornarChamado,
        verificar_adneia: verificarAdneia,
        status_devolucao: statusDevolucaoParam || null,
        transportadora: pedidoErp?.transportadora || null
      };
      
      // Se marcou encerrar ao criar, adiciona os campos de fechamento
      if (!isEditMode && encerrarAoCriar) {
        payload.pendente = false;
        payload.data_fechamento = new Date().toISOString();
      }
      
      if (isEditMode && atendimentoId) {
        // Atualizar atendimento existente
        await axios.put(
          `${API_URL}/api/chamados/${atendimentoId}`,
          payload,
          { headers: getAuthHeader() }
        );
        
        toast.success('Atendimento atualizado com sucesso!');
        // Navegar para lista mantendo o filtro
        const redirectUrl = filterParam ? `/chamados?filter=${filterParam}` : '/chamados';
        navigate(redirectUrl);
      } else {
        // Criar novo atendimento
        const response = await axios.post(
          `${API_URL}/api/chamados`,
          payload,
          { headers: getAuthHeader() }
        );
        
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{response.data.id_atendimento} criado com sucesso!</span>
            <span className="text-xs opacity-80">Sincronizando com Google Sheets...</span>
          </div>
        );
        // Navegar para lista mantendo o filtro
        const redirectUrl = filterParam ? `/chamados?filter=${filterParam}` : '/chamados';
        navigate(redirectUrl);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Erro ao ${isEditMode ? 'atualizar' : 'criar'} atendimento`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEncerrar = async () => {
    if (!isEditMode || !atendimentoId) return;
    
    // Reset errors
    setFieldErrors({
      solicitacao: false,
      categoria: false,
      motivo: false,
      motivoPendencia: false,
      anotacoes: false
    });
    
    // Validação de campos obrigatórios para encerrar
    let hasError = false;
    const newErrors = { solicitacao: false, categoria: false, motivo: false, motivoPendencia: false, anotacoes: false };
    
    if (!formData.solicitacao.trim()) {
      toast.error('Preencha o campo Solicitação antes de encerrar');
      newErrors.solicitacao = true;
      hasError = true;
    }
    if (!formData.categoria) {
      toast.error('Selecione a categoria antes de encerrar');
      newErrors.categoria = true;
      hasError = true;
    }
    if (!formData.motivo.trim()) {
      toast.error('Preencha o campo Motivo antes de encerrar');
      newErrors.motivo = true;
      hasError = true;
    }
    if (!motivoPendencia.trim()) {
      toast.error('Preencha o Motivo da Pendência antes de encerrar');
      newErrors.motivoPendencia = true;
      hasError = true;
    }
    if (!formData.anotacoes.trim()) {
      toast.error('Preencha as Anotações antes de encerrar');
      newErrors.anotacoes = true;
      hasError = true;
    }
    
    // Validar se o motivo de pendência permite encerrar
    if (!MOTIVOS_FINALIZADORES.includes(motivoPendencia)) {
      toast.error(`O motivo "${motivoPendencia}" não permite encerrar o atendimento. Use: Entregue, Estornado, Atendido ou Em devolução.`);
      newErrors.motivoPendencia = true;
      hasError = true;
    }
    
    if (hasError) {
      setFieldErrors(newErrors);
      return;
    }
    
    const hoje = new Date().toLocaleDateString('pt-BR');
    const novaAnotacao = `[${hoje}] *** ATENDIMENTO ENCERRADO ***`;
    const anotacoesAtuais = formData.anotacoes;
    const novasAnotacoes = anotacoesAtuais 
      ? `${novaAnotacao}\n\n${anotacoesAtuais}`
      : novaAnotacao;
    
    setLoading(true);
    try {
      await axios.put(
        `${API_URL}/api/chamados/${atendimentoId}`,
        { 
          pendente: false,
          retornar_chamado: false,
          verificar_adneia: false,
          anotacoes: novasAnotacoes
        },
        { headers: getAuthHeader() }
      );
      
      toast.success('Atendimento encerrado com sucesso!');
      navigate('/chamados');
    } catch (error) {
      toast.error('Erro ao encerrar atendimento');
    } finally {
      setLoading(false);
    }
  };

  // Função para registrar devolução na planilha
  const registrarDevolucao = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/devolucoes`,
        {
          numero_pedido: formData.numero_pedido,
          nome_cliente: pedidoErp?.nome_cliente || '',
          cpf_cliente: pedidoErp?.cpf_cliente || '',
          solicitacao: formData.solicitacao || '',
          canal_vendas: formData.parceiro || pedidoErp?.canal_vendas || '',
          motivo: formData.motivo || '',
          codigo_reversa: codigoReversa || '',
          chamado_id: atendimentoId || '',
          id_atendimento: atendimentoOriginal?.id_atendimento || '',
          produto: pedidoErp?.produto || '',
          filial: pedidoErp?.uf_galpao || ''
        },
        { headers: getAuthHeader() }
      );
      
      if (response.data.sync_status === 'success') {
        toast.success('Devolução registrada na planilha!');
        setDevolucaoRegistrada(true);
        return true;
      } else {
        toast.error('Falha ao registrar na planilha');
        return false;
      }
    } catch (error) {
      toast.error('Erro ao registrar devolução na planilha');
      return false;
    }
  };

  // Handler para quando muda o motivo da pendência para "Em devolução" ou "Devolvido"
  const handleMotivoPendenciaChange = async (value) => {
    setMotivoPendencia(value);
    if (fieldErrors.motivoPendencia) setFieldErrors(prev => ({...prev, motivoPendencia: false}));
    
    // Se mudou para "Em devolução" ou "Devolvido", mostrar diálogo perguntando se quer registrar
    if (value === 'Em devolução' || value === 'Devolvido') {
      // Resetar status de devolução para forçar nova seleção
      setStatusDevolucao('');
      setDevolucaoRegistrada(false);
      
      // Mostrar diálogo perguntando se quer registrar na planilha
      if (formData.numero_pedido) {
        setShowDevolucaoDialog(true);
      }
    }
  };

  // Handler unificado para registrar devolução com status selecionado
  const handleRegistrarDevolucaoComStatus = async (status) => {
    setShowDevolucaoDialog(false);
    setLoading(true);
    
    try {
      // Determinar "Devolvido por": Correios (se tem reversa) ou nome da Transportadora específica
      let devolvidoPor = '';
      if (codigoReversa) {
        devolvidoPor = 'Correios';
      } else {
        // Buscar nome da transportadora do pedido ERP ou do atendimento
        const transportadora = pedidoErp?.transportadora || atendimentoOriginal?.transportadora || '';
        
        // Normalizar nome da transportadora
        if (transportadora) {
          const t = transportadora.toLowerCase();
          if (t.includes('total') || t.includes('tex')) {
            devolvidoPor = 'Total Express';
          } else if (t.includes('j&t') || t.includes('jt') || t.includes('j t') || t.includes('j e t')) {
            devolvidoPor = 'J&T';
          } else if (t.includes('cb') || t.includes('cb log')) {
            devolvidoPor = 'CB';
          } else if (t.includes('asap') || t.includes('logistica e solucoes') || t.includes('logística e soluções')) {
            devolvidoPor = 'ASAP Log';
          } else {
            // Usar nome original se não reconhecer
            devolvidoPor = transportadora;
          }
        } else {
          devolvidoPor = 'Transportadora';
        }
      }
      
      // Registrar na planilha de devoluções via API
      const response = await axios.post(
        `${API_URL}/api/devolucoes`,
        {
          numero_pedido: formData.numero_pedido,
          nome_cliente: pedidoErp?.nome_cliente || '',
          cpf_cliente: pedidoErp?.cpf_cliente || '',
          solicitacao: formData.solicitacao || '',
          canal_vendas: formData.parceiro || pedidoErp?.canal_vendas || '',
          motivo: formData.motivo || '',
          codigo_reversa: codigoReversa || '',
          chamado_id: atendimentoId || '',
          id_atendimento: atendimentoOriginal?.id_atendimento || '',
          produto: pedidoErp?.produto || '',
          filial: pedidoErp?.uf_galpao || '',
          // Campos para colunas J, K, L
          atendimento: status,  // Coluna J: Aguardando/Estornado/Reenviado
          devolvido_por: devolvidoPor,  // Coluna K: Correios ou nome da Transportadora
          status_galpao: 'AGUARDANDO'  // Coluna L
        },
        { headers: getAuthHeader() }
      );
      
      if (response.data.sync_status === 'success') {
        toast.success(`Devolução registrada! Status: ${status}, Devolvido por: ${devolvidoPor}`);
        setStatusDevolucao(status);
        setDevolucaoRegistrada(true);
      } else {
        toast.error('Falha ao registrar na planilha');
      }
    } catch (error) {
      toast.error('Erro ao registrar devolução na planilha');
      console.error('Erro ao registrar devolução:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    if (!status) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('entreg')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400';
    if (statusLower.includes('trânsito') || statusLower.includes('transito')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400';
    if (statusLower.includes('aguardando') || statusLower.includes('pendente')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="novo-atendimento-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">
          {isEditMode ? 'Editar Atendimento' : 'Novo Atendimento'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isEditMode 
            ? `Atualize o atendimento ${atendimentoOriginal?.id_atendimento || ''}` 
            : 'Registre um novo atendimento no sistema ELO'
          }
        </p>
      </div>

      {loadingAtendimento ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Carregando atendimento...</span>
          </CardContent>
        </Card>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Buscar Pedido */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              1. Buscar Pedido
            </CardTitle>
            <CardDescription>Busque por Pedido, CPF, Nome, Entrega ou Galpão+Nota</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-40" data-testid="select-search-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pedido">Pedido</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                  <SelectItem value="galpao">Galpão + Nota</SelectItem>
                </SelectContent>
              </Select>
              
              {searchType === 'galpao' && (
                <Select value={selectedGalpao} onValueChange={setSelectedGalpao}>
                  <SelectTrigger className="w-24" data-testid="select-galpao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SC">SC</SelectItem>
                    <SelectItem value="SP">SP</SelectItem>
                    <SelectItem value="ES">ES</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              <div className="flex-1 relative">
                <Input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={
                    searchType === 'pedido' ? 'Digite o número do pedido' : 
                    searchType === 'cpf' ? 'Digite o CPF do cliente' : 
                    searchType === 'nome' ? 'Digite o nome do cliente' :
                    searchType === 'galpao' ? 'Digite o número da Nota Fiscal' :
                    'Digite o número da Entrega'
                  }
                  className="text-lg h-12 pr-12"
                  data-testid="input-search"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {searchingPedido && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                  {!searchingPedido && pedidoErp && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                  {!searchingPedido && pedidoNotFound && <AlertCircle className="h-5 w-5 text-amber-500" />}
                </div>
              </div>
            </div>
            
            {pedidoNotFound && !modoFalhaIntegracao && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  Nenhum pedido encontrado. Verifique o número e tente novamente.
                </p>
                <Button 
                  type="button"
                  variant="outline"
                  className="border-amber-500 text-amber-700 hover:bg-amber-100"
                  onClick={() => {
                    setModoFalhaIntegracao(true);
                    setFormData(prev => ({
                      ...prev,
                      numero_pedido: searchValue,
                      categoria: 'Falha de Integração',
                      motivo: 'Pedido não localizado na base'
                    }));
                    setPedidoNotFound(false);
                  }}
                  data-testid="btn-falha-integracao"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Abrir Chamado de Falha de Integração
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modo Falha de Integração */}
        {modoFalhaIntegracao && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-5 w-5" />
                  Falha de Integração
                </CardTitle>
                <Button 
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setModoFalhaIntegracao(false);
                    setFormData(prev => ({ ...prev, categoria: '', motivo: '', numero_pedido: '' }));
                  }}
                >
                  Cancelar
                </Button>
              </div>
              <CardDescription className="text-amber-600 dark:text-amber-400">
                Pedido não encontrado na base. Preencha os dados manualmente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>CPF do Cliente <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.numero_pedido}
                    onChange={(e) => handleChange('numero_pedido', e.target.value)}
                    placeholder="Digite o CPF do cliente"
                    data-testid="input-numero-pedido-falha"
                  />
                  <p className="text-xs text-amber-600 mt-1">* Este campo será usado como identificador do atendimento</p>
                </div>
                <div>
                  <Label>Solicitação <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.solicitacao}
                    onChange={(e) => handleChange('solicitacao', e.target.value)}
                    placeholder="Número da solicitação"
                    className={fieldErrors.solicitacao ? 'border-red-500' : ''}
                    data-testid="input-solicitacao-falha"
                  />
                </div>
              </div>
              
              <div>
                <Label>Parceiro/Canal <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.parceiro}
                  onChange={(e) => handleChange('parceiro', e.target.value)}
                  placeholder="Digite o parceiro ou canal de venda"
                  data-testid="input-parceiro-falha"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dados do Pedido */}
        {pedidoErp && (
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20" data-testid="pedido-info">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-600" />
                  Pedido #{pedidoErp.numero_pedido}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={getStatusBadgeColor(pedidoErp.status_pedido)}>
                      {pedidoErp.status_pedido || 'Sem status'}
                    </Badge>
                    {pedidoErp.data_status && (
                      <span className="text-xs text-muted-foreground">
                        Últ. Ponto: {pedidoErp.data_status}
                      </span>
                    )}
                  </div>
                  <Button type="button"
                    variant="ghost" 
                    size="sm"
                    onClick={() => setPedidoExpanded(!pedidoExpanded)}
                    className="h-8 w-8 p-0"
                    data-testid="expand-pedido-btn"
                  >
                    {pedidoExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {pedidoExpanded && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <User className="h-4 w-4" /> Cliente
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.nome_cliente || '-'}</p>
                    {pedidoErp.cpf_cliente && <p className="text-muted-foreground">CPF: {pedidoErp.cpf_cliente}</p>}
                    {pedidoErp.email_cliente && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {pedidoErp.email_cliente}
                      </p>
                    )}
                    {pedidoErp.fone_cliente && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {pedidoErp.fone_cliente}
                      </p>
                    )}
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Endereço
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    {pedidoErp.cidade && pedidoErp.uf ? (
                      <p className="font-medium">{pedidoErp.cidade} - {pedidoErp.uf}</p>
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                    {pedidoErp.cep && <p className="text-muted-foreground">CEP: {pedidoErp.cep}</p>}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Produto */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" /> Produto
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.produto || '-'}</p>
                    {pedidoErp.departamento && <p className="text-muted-foreground">Marca: {pedidoErp.departamento}</p>}
                    {pedidoErp.codigo_item_bseller && <p className="text-muted-foreground">ID: {pedidoErp.codigo_item_bseller}</p>}
                    {pedidoErp.codigo_item_vtex && <p className="text-muted-foreground">SKU: {pedidoErp.codigo_item_vtex}</p>}
                    {pedidoErp.codigo_fornecedor && <p className="text-muted-foreground">Cód. Fornecedor: {pedidoErp.codigo_fornecedor}</p>}
                    {pedidoErp.quantidade && <p className="text-muted-foreground">Qtde: {pedidoErp.quantidade}</p>}
                    {(pedidoErp.estoque_disponivel !== undefined && pedidoErp.estoque_disponivel !== null) && (
                      <p className={`font-medium ${Number(pedidoErp.estoque_disponivel) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Estoque Disp.: {pedidoErp.estoque_disponivel}
                      </p>
                    )}
                    {pedidoErp.preco_final && (
                      <p className="text-muted-foreground">
                        Valor: R$ {parseFloat(pedidoErp.preco_final).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Entrega */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Entrega
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.transportadora || '-'}</p>
                    {pedidoErp.canal_vendas && <p className="text-muted-foreground">Canal: {pedidoErp.canal_vendas}</p>}
                    {pedidoErp.data_status && <p className="text-muted-foreground">Atualização: {pedidoErp.data_status}</p>}
                  </div>
                </div>
              </div>

              {pedidoErp.nota_fiscal && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Nota Fiscal
                    </h4>
                    <div className="pl-6 space-y-1 text-sm">
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <p><span className="text-muted-foreground">NF:</span> {String(pedidoErp.nota_fiscal).split('.')[0]}</p>
                        {pedidoErp.uf_galpao && pedidoErp.uf_galpao !== '-' && (
                          <p><span className="text-muted-foreground">Galpão:</span> <span className="font-medium">{pedidoErp.uf_galpao}</span></p>
                        )}
                      </div>
                      {pedidoErp.chave_nota && (
                        <p className="text-xs text-muted-foreground break-all">Chave: {pedidoErp.chave_nota}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            )}
          </Card>
        )}

        {/* Dados do Atendimento (quando não há pedido ERP mas está em modo edição) */}
        {!pedidoErp && isEditMode && atendimentoOriginal && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20" data-testid="atendimento-info">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-600" />
                Atendimento #{atendimentoOriginal.id_atendimento || formData.numero_pedido}
              </CardTitle>
              <CardDescription className="text-xs text-amber-600">
                ⚠️ Pedido não encontrado na base ERP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {atendimentoOriginal.numero_pedido && (
                  <div>
                    <span className="text-muted-foreground">Entrega:</span>
                    <p className="font-medium">{atendimentoOriginal.numero_pedido}</p>
                  </div>
                )}
                {atendimentoOriginal.nome_cliente && (
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <p className="font-medium">{atendimentoOriginal.nome_cliente}</p>
                  </div>
                )}
                {atendimentoOriginal.parceiro && (
                  <div>
                    <span className="text-muted-foreground">Parceiro:</span>
                    <p className="font-medium">{atendimentoOriginal.parceiro}</p>
                  </div>
                )}
                {atendimentoOriginal.categoria && (
                  <div>
                    <span className="text-muted-foreground">Categoria:</span>
                    <p className="font-medium">{atendimentoOriginal.categoria}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Classificação */}
        {(pedidoErp || modoFalhaIntegracao || isEditMode) && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  2. Classificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className={fieldErrors.solicitacao ? 'text-red-600' : ''}>
                      Solicitação (Parceiro) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={formData.solicitacao}
                      onChange={(e) => {
                        handleChange('solicitacao', e.target.value);
                        if (fieldErrors.solicitacao) setFieldErrors(prev => ({...prev, solicitacao: false}));
                      }}
                      placeholder="Nº da solicitação"
                      data-testid="input-solicitacao"
                      className={fieldErrors.solicitacao ? 'border-red-500 focus:ring-red-500' : ''}
                    />
                  </div>

                  <div>
                    <Label>Parceiro/Canal</Label>
                    <Input
                      value={formData.parceiro}
                      onChange={(e) => handleChange('parceiro', e.target.value)}
                      placeholder="Ex: CSU, Livelo"
                      data-testid="input-parceiro"
                    />
                  </div>

                  <div>
                    <Label>Atendente (última revisão)</Label>
                    <Input
                      value={user?.name || formData.atendente || ''}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                      data-testid="input-atendente"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Atualizado automaticamente ao salvar</p>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label className={fieldErrors.categoria ? 'text-red-600' : ''}>
                      Categoria <span className="text-red-500">*</span>
                    </Label>
                    {isEditMode && formData.categoria_inicial && (
                      <p className="text-xs text-amber-600 mb-1">
                        Categoria inicial: <strong>{formData.categoria_inicial}</strong>
                        {formData.categoria !== formData.categoria_inicial && ' (alterada)'}
                      </p>
                    )}
                    <Select 
                      value={formData.categoria} 
                      onValueChange={(v) => {
                        handleChange('categoria', v);
                        if (fieldErrors.categoria) setFieldErrors(prev => ({...prev, categoria: false}));
                      }}
                    >
                      <SelectTrigger 
                        data-testid="select-categoria"
                        className={fieldErrors.categoria ? 'border-red-500 focus:ring-red-500' : ''}
                      >
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label className={fieldErrors.motivo ? 'text-red-600' : ''}>
                      Motivo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={formData.motivo}
                      onChange={(e) => {
                        handleChange('motivo', e.target.value);
                        if (fieldErrors.motivo) setFieldErrors(prev => ({...prev, motivo: false}));
                      }}
                      placeholder="Motivo específico do atendimento"
                      data-testid="input-motivo"
                      className={fieldErrors.motivo ? 'border-red-500 focus:ring-red-500' : ''}
                    />
                  </div>
                </div>

                {/* Ações rápidas */}
                {formData.categoria && (
                  <div className="space-y-3 pt-2">
                    {formData.categoria === 'Produto com Avaria' ? (
                      <div className="space-y-2">
                        <Label>Tipo de Avaria</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            type="button" 
                            variant={selectedAvaria === 'Avaria - Necessário Evidência' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => loadTextoAvaria('Avaria - Necessário Evidência')}
                            data-testid="btn-avaria-evidencia"
                          >
                            Necessário Evidência
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedAvaria === 'Avaria - Transporte até R$250' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => loadTextoAvaria('Avaria - Transporte até R$250')}
                            data-testid="btn-avaria-250"
                          >
                            Transporte até R$250
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedAvaria === 'Avaria - Reversa' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => loadTextoAvaria('Avaria - Reversa')}
                            data-testid="btn-avaria-reversa"
                          >
                            Reversa
                          </Button>
                        </div>
                      </div>
                    ) : formData.categoria === 'Falha Produção' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>Tipo de Resposta</Label>
                          {transportadoraDetectada && pedidoErp?.transportadora && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Transportadora: {pedidoErp.transportadora}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            type="button" 
                            variant={selectedFalhaProducao === 'Sem Rastreio' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => loadTextoFalhaProducao('Sem Rastreio')}
                            data-testid="btn-producao-sem-rastreio"
                          >
                            Sem Rastreio
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedFalhaProducao === 'Com Rastreio - Total Express' ? 'default' : (transportadoraDetectada === 'Com Rastreio - Total Express' ? 'secondary' : 'outline')}
                            size="sm"
                            onClick={() => loadTextoFalhaProducao('Com Rastreio - Total Express')}
                            data-testid="btn-producao-total"
                            className={transportadoraDetectada === 'Com Rastreio - Total Express' ? 'ring-2 ring-blue-400' : ''}
                          >
                            Total Express {transportadoraDetectada === 'Com Rastreio - Total Express' && '✓'}
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedFalhaProducao === 'Com Rastreio - J&T Express' ? 'default' : (transportadoraDetectada === 'Com Rastreio - J&T Express' ? 'secondary' : 'outline')}
                            size="sm"
                            onClick={() => loadTextoFalhaProducao('Com Rastreio - J&T Express')}
                            data-testid="btn-producao-jt"
                            className={transportadoraDetectada === 'Com Rastreio - J&T Express' ? 'ring-2 ring-blue-400' : ''}
                          >
                            J&T Express {transportadoraDetectada === 'Com Rastreio - J&T Express' && '✓'}
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedFalhaProducao === 'Com Rastreio - ASAP Log' ? 'default' : (transportadoraDetectada === 'Com Rastreio - ASAP Log' ? 'secondary' : 'outline')}
                            size="sm"
                            onClick={() => loadTextoFalhaProducao('Com Rastreio - ASAP Log')}
                            data-testid="btn-producao-asap"
                            className={transportadoraDetectada === 'Com Rastreio - ASAP Log' ? 'ring-2 ring-blue-400' : ''}
                          >
                            ASAP Log {transportadoraDetectada === 'Com Rastreio - ASAP Log' && '✓'}
                          </Button>
                        </div>
                      </div>
                    ) : formData.categoria === 'Falha Compras' ? (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Textos Padrão - Falha Compras</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => loadTextoPadrao('Falha Compras')}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Em Preparação
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => loadTextoPadrao('Falha Compras - Em Separação')}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Em Separação
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => loadTextoPadrao('Falha Compras - Cancelamento sem Estoque')}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Cancelamento sem Estoque
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => loadTextoPadrao('Falha Compras - Cancelado')}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Cancelado
                          </Button>
                        </div>
                      </div>
                    ) : formData.categoria === 'Falha Transporte' ? (
                      <div className="space-y-3">
                        {/* Enviar Rastreio */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium">Enviar Rastreio</Label>
                            {pedidoErp?.transportadora && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {pedidoErp.transportadora}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {['Rastreio - Total Express', 'Rastreio - J&T Express', 'Rastreio - ASAP Log', 'Rastreio - Correios'].map(tipo => {
                              const isDetected = getRastreioTransporte() === tipo;
                              return (
                                <Button 
                                  key={tipo}
                                  type="button" 
                                  variant={selectedFalhaTransporte === tipo ? 'default' : (isDetected ? 'secondary' : 'outline')}
                                  size="sm"
                                  onClick={() => loadTextoFalhaTransporte(tipo)}
                                  className={isDetected ? 'ring-2 ring-blue-400' : ''}
                                >
                                  {tipo.replace('Rastreio - ', '')} {isDetected && '✓'}
                                </Button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bloqueio */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Bloqueio de Entrega</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedFalhaTransporte === 'Bloqueio da Entrega' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaTransporte('Bloqueio da Entrega')}
                            >
                              Bloqueio OK
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedFalhaTransporte === 'Não é Possível Bloqueio' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaTransporte('Não é Possível Bloqueio')}
                            >
                              Não é Possível
                            </Button>
                          </div>
                        </div>

                        {/* Extravio */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Extravio</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedFalhaTransporte === 'Extravio' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaTransporte('Extravio')}
                            >
                              Extravio
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedFalhaTransporte === 'Extravio com Previsão' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaTransporte('Extravio com Previsão')}
                            >
                              Com Previsão
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedFalhaTransporte === 'Extravio com Cancelamento' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaTransporte('Extravio com Cancelamento')}
                            >
                              Com Cancelamento
                            </Button>
                          </div>
                        </div>

                        {/* Comprovante */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Comprovante de Entrega</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedFalhaTransporte === 'Falta Comprovante' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaTransporte('Falta Comprovante')}
                            >
                              Falta Comprovante
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedFalhaTransporte === 'Desconhece Entrega - No Prazo' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaTransporte('Desconhece Entrega - No Prazo')}
                            >
                              Desconhece (No Prazo)
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedFalhaTransporte === 'Desconhece Entrega - Fora Prazo' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaTransporte('Desconhece Entrega - Fora Prazo')}
                            >
                              Desconhece (Fora Prazo)
                            </Button>
                            {formData.parceiro?.toLowerCase().includes('csu') && (
                              <Button 
                                type="button" 
                                variant={selectedFalhaTransporte === 'CSU - Comprovante Email' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => loadTextoFalhaTransporte('CSU - Comprovante Email')}
                                className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                              >
                                CSU - Email
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : formData.categoria === 'Falha Fornecedor' ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Reversa</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedFalhaFornecedor === '1ª Reversa' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaFornecedor('1ª Reversa')}
                            >
                              1ª Reversa
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedFalhaFornecedor === '2ª Reversa' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoFalhaFornecedor('2ª Reversa')}
                            >
                              2ª Reversa
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : formData.categoria === 'Arrependimento' ? (
                      <div className="space-y-3">
                        {/* Reversa */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Reversa</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === '1ª Reversa' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('1ª Reversa')}
                            >
                              1ª Reversa
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === '2ª Reversa' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('2ª Reversa')}
                            >
                              2ª Reversa
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Reversa Irá Vencer' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Reversa Irá Vencer')}
                            >
                              Irá Vencer
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Reversa Expirada' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Reversa Expirada')}
                            >
                              Expirada
                            </Button>
                          </div>
                        </div>

                        {/* Em Devolução */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Em Devolução</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Em Devolução - Sem Estorno' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Em Devolução - Sem Estorno')}
                            >
                              Sem Estorno
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Em Devolução - Com Estorno' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Em Devolução - Com Estorno')}
                            >
                              Com Estorno
                            </Button>
                          </div>
                        </div>

                        {/* Devolvido */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Devolvido</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Devolvido - Com Estorno' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Devolvido - Com Estorno')}
                            >
                              Com Estorno
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Devolvido - Com Reenvio' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Devolvido - Com Reenvio')}
                            >
                              Com Reenvio
                            </Button>
                          </div>
                        </div>

                        {/* Bloqueio */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Bloqueio/Barragem</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Bloqueio da Entrega' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Bloqueio da Entrega')}
                            >
                              Bloqueio OK
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Enviado Sem Bloqueio' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Enviado Sem Bloqueio')}
                            >
                              Sem Bloqueio
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Em Separação' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Em Separação')}
                            >
                              Em Separação
                            </Button>
                          </div>
                        </div>

                        {/* Outros */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Outros</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Impossibilidade Coleta' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Impossibilidade Coleta')}
                            >
                              Sem Coleta
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedArrependimento === 'Prazo Expirado' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoArrependimento('Prazo Expirado')}
                            >
                              Prazo Expirado
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : formData.categoria === 'Acompanhamento' ? (
                      <div className="space-y-3">
                        {/* Entrega */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Status da Entrega</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedAcompanhamento === 'Entregue - Possível Contestação' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAcompanhamento('Entregue - Possível Contestação')}
                            >
                              Entregue (Possível Contestação)
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedAcompanhamento === 'Entregue - Contestação Expirada' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAcompanhamento('Entregue - Contestação Expirada')}
                            >
                              Entregue (Contestação Expirada)
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedAcompanhamento === 'Sem Comprovante de Entrega' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAcompanhamento('Sem Comprovante de Entrega')}
                            >
                              Sem Comprovante
                            </Button>
                          </div>
                        </div>

                        {/* Em Processo de Entrega */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium">Em Processo de Entrega</Label>
                            {pedidoErp?.transportadora && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {pedidoErp.transportadora}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {['Em Processo - Total Express', 'Em Processo - J&T Express', 'Em Processo - ASAP Log', 'Em Processo - Correios'].map(tipo => {
                              const isDetected = getRastreioAcompanhamento() === tipo;
                              return (
                                <Button 
                                  key={tipo}
                                  type="button" 
                                  variant={selectedAcompanhamento === tipo ? 'default' : (isDetected ? 'secondary' : 'outline')}
                                  size="sm"
                                  onClick={() => loadTextoAcompanhamento(tipo)}
                                  className={isDetected ? 'ring-2 ring-blue-400' : ''}
                                >
                                  {tipo.replace('Em Processo - ', '')} {isDetected && '✓'}
                                </Button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Outros */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Outros</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedAcompanhamento === 'Cancelamento por Falta' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAcompanhamento('Cancelamento por Falta')}
                            >
                              Cancelamento por Falta
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedAcompanhamento === 'Falha de Integração' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAcompanhamento('Falha de Integração')}
                            >
                              Falha de Integração
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedAcompanhamento === 'Ag. Compras' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAcompanhamento('Ag. Compras')}
                            >
                              Ag. Compras
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedAcompanhamento === 'Problema na Emissão da NF' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAcompanhamento('Problema na Emissão da NF')}
                            >
                              Problema NF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : formData.categoria === 'Reclame Aqui' ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Respostas Padrão</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedReclameAqui === 'Resposta Inicial' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoReclameAqui('Resposta Inicial')}
                            >
                              Resposta Inicial
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedReclameAqui === 'Mensagem WhatsApp' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoReclameAqui('Mensagem WhatsApp')}
                            >
                              Mensagem WhatsApp
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedReclameAqui === 'Solicitar Encerramento' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoReclameAqui('Solicitar Encerramento')}
                            >
                              Solicitar Encerramento
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedReclameAqui === 'Após Avaliação' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoReclameAqui('Após Avaliação')}
                            >
                              Após Avaliação
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : formData.categoria === 'Comprovante de Entrega' ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Textos para Comprovante de Entrega</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedComprovante === 'Confirmação' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoComprovante('Confirmação')}
                            >
                              Confirmação
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedComprovante === 'Dentro do Prazo' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoComprovante('Dentro do Prazo')}
                            >
                              Dentro do Prazo
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedComprovante === 'Expirado' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoComprovante('Expirado')}
                            >
                              Expirado
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedComprovante === 'Expirado para Encerrar' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoComprovante('Expirado para Encerrar')}
                            >
                              Expirado p/ Encerrar
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedComprovante === 'Email CSU' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoComprovante('Email CSU')}
                            >
                              Email CSU
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : formData.categoria === 'Assistência Técnica' ? (
                      <div className="space-y-3">
                        {/* Indicador do fornecedor do pedido */}
                        {pedidoErp?.departamento && (
                          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                            <p className="text-sm text-emerald-700 dark:text-emerald-300">
                              <span className="font-semibold">Fornecedor do pedido:</span> {pedidoErp.departamento}
                            </p>
                          </div>
                        )}
                        {/* Fornecedores */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">SAC do Fornecedor</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedAssistencia === 'Oderço' ? 'default' : pedidoErp?.departamento?.toLowerCase().includes('oderço') || pedidoErp?.departamento?.toLowerCase().includes('oderco') ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAssistencia('Oderço')}
                              className={pedidoErp?.departamento?.toLowerCase().includes('oderço') || pedidoErp?.departamento?.toLowerCase().includes('oderco') ? 'ring-2 ring-emerald-500' : ''}
                            >
                              {(pedidoErp?.departamento?.toLowerCase().includes('oderço') || pedidoErp?.departamento?.toLowerCase().includes('oderco')) && '✓ '}Oderço
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedAssistencia === 'Ventisol' ? 'default' : pedidoErp?.departamento?.toLowerCase().includes('ventisol') ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAssistencia('Ventisol')}
                              className={pedidoErp?.departamento?.toLowerCase().includes('ventisol') ? 'ring-2 ring-emerald-500' : ''}
                            >
                              {pedidoErp?.departamento?.toLowerCase().includes('ventisol') && '✓ '}Ventisol
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedAssistencia === 'OEX' ? 'default' : pedidoErp?.departamento?.toLowerCase().includes('oex') ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAssistencia('OEX')}
                              className={pedidoErp?.departamento?.toLowerCase().includes('oex') ? 'ring-2 ring-emerald-500' : ''}
                            >
                              {pedidoErp?.departamento?.toLowerCase().includes('oex') && '✓ '}OEX
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedAssistencia === 'Hoopson' ? 'default' : pedidoErp?.departamento?.toLowerCase().includes('hoopson') ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAssistencia('Hoopson')}
                              className={pedidoErp?.departamento?.toLowerCase().includes('hoopson') ? 'ring-2 ring-emerald-500' : ''}
                            >
                              {pedidoErp?.departamento?.toLowerCase().includes('hoopson') && '✓ '}Hoopson
                            </Button>
                          </div>
                        </div>

                        {/* Fornecedor + Reversa */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">SAC + Opção Reversa</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              type="button" 
                              variant={selectedAssistencia === 'Ventisol + Reversa' ? 'default' : pedidoErp?.departamento?.toLowerCase().includes('ventisol') ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAssistencia('Ventisol + Reversa')}
                              className={pedidoErp?.departamento?.toLowerCase().includes('ventisol') ? 'ring-2 ring-emerald-500' : ''}
                            >
                              {pedidoErp?.departamento?.toLowerCase().includes('ventisol') && '✓ '}Ventisol + Reversa
                            </Button>
                            <Button 
                              type="button" 
                              variant={selectedAssistencia === 'OEX + Reversa' ? 'default' : pedidoErp?.departamento?.toLowerCase().includes('oex') ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => loadTextoAssistencia('OEX + Reversa')}
                              className={pedidoErp?.departamento?.toLowerCase().includes('oex') ? 'ring-2 ring-emerald-500' : ''}
                            >
                              {pedidoErp?.departamento?.toLowerCase().includes('oex') && '✓ '}OEX + Reversa
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => loadTextoPadrao(formData.categoria)}
                          data-testid="btn-texto-padrao"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Ver Texto Padrão
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Anotações */}
            <Card className={fieldErrors.anotacoes ? 'border-red-500' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  3. Anotações {!isEditMode && <span className="text-red-500">*</span>}
                </CardTitle>
                <CardDescription>
                  {fieldErrors.anotacoes 
                    ? <span className="text-red-500">⚠️ É obrigatório adicionar uma anotação para salvar o atendimento</span>
                    : isEditMode 
                      ? 'Registre o histórico e observações do atendimento (opcional na edição)'
                      : 'Registre o histórico e observações do atendimento'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Dados da Reversa */}
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3">
                  <Label className="text-sm font-medium text-blue-800 dark:text-blue-200">Dados da Reversa</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Número da Reversa</Label>
                      <Input
                        value={codigoReversa}
                        onChange={(e) => setCodigoReversa(e.target.value)}
                        placeholder="Digite o código da reversa"
                        className="mt-1"
                        data-testid="input-numero-reversa"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Data de Vencimento</Label>
                      <Input
                        type="date"
                        value={dataVencimentoReversa}
                        onChange={(e) => setDataVencimentoReversa(e.target.value)}
                        className="mt-1"
                        data-testid="input-data-vencimento-reversa"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className={fieldErrors.motivoPendencia ? 'text-red-600' : ''}>
                    Motivo da Pendência <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={motivoPendencia} 
                    onValueChange={handleMotivoPendenciaChange}
                  >
                    <SelectTrigger 
                      data-testid="select-motivo-pendencia"
                      className={fieldErrors.motivoPendencia ? 'border-red-500 focus:ring-red-500' : ''}
                    >
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Motivos de Acompanhamento
                      </div>
                      {MOTIVOS_PENDENCIA.filter(m => !MOTIVOS_FINALIZADORES.includes(m)).map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-2 pt-2">
                        Motivos Finalizadores
                      </div>
                      {MOTIVOS_FINALIZADORES.map(m => (
                        <SelectItem key={m} value={m} className="text-emerald-700 dark:text-emerald-400">
                          ✓ {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pedidoErp?.status_pedido && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Status atual: {pedidoErp.status_pedido}
                    </p>
                  )}
                  
                  {/* Textos padrão baseados no Motivo da Pendência */}
                  {motivoPendencia === 'Ag. Confirmação de Entrega' && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                      <Label className="text-sm font-medium text-amber-800 dark:text-amber-200">Textos Padrão - Confirmação de Entrega</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Ag. Confirmação de Entrega' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Ag. Confirmação de Entrega')}
                        >
                          Solicitar Confirmação
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Ag. Confirmação - Extravio' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Ag. Confirmação - Extravio')}
                        >
                          Extravio
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Ag. Confirmação - Reenvio' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Ag. Confirmação - Reenvio')}
                        >
                          Reenvio
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Ag. Confirmação - Confirmado' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Ag. Confirmação - Confirmado')}
                        >
                          Confirmado
                        </Button>
                      </div>
                    </div>
                  )}

                  {motivoPendencia === 'Ag. Parceiro' && (
                    <div className="mt-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-2">
                      <Label className="text-sm font-medium text-purple-800 dark:text-purple-200">Textos Padrão - Ag. Parceiro</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Ag. Parceiro - Estorno' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Ag. Parceiro - Estorno')}
                        >
                          Estorno
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Ag. Parceiro - Confirmação Encerramento' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Ag. Parceiro - Confirmação Encerramento')}
                        >
                          Confirmação Encerramento
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Ag. Parceiro - Encerramento' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Ag. Parceiro - Encerramento')}
                        >
                          Encerramento
                        </Button>
                      </div>
                    </div>
                  )}

                  {motivoPendencia === 'Em devolução' && (
                    <div className="mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2">
                      <Label className="text-sm font-medium text-rose-800 dark:text-rose-200">Textos Padrão - Em Devolução</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Em devolução - Ag. Devolução' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Em devolução - Ag. Devolução')}
                        >
                          Ag. Devolução
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Em devolução - Liberar Estorno' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Em devolução - Liberar Estorno')}
                        >
                          Liberar Estorno
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Em devolução - Confirmar Reenvio' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Em devolução - Confirmar Reenvio')}
                        >
                          Confirmar Reenvio
                        </Button>
                      </div>
                    </div>
                  )}

                  {motivoPendencia === 'Devolvido' && (
                    <div className="mt-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-2">
                      <Label className="text-sm font-medium text-purple-800 dark:text-purple-200">Textos Padrão - Devolvido</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Devolvido - Problema Transportadora' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Devolvido - Problema Transportadora')}
                        >
                          Problema Transportadora
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Devolvido - Cancelamento e Estorno' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Devolvido - Cancelamento e Estorno')}
                        >
                          Cancelamento e Estorno
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Devolvido - Reenvio' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Devolvido - Reenvio')}
                        >
                          Reenvio
                        </Button>
                      </div>
                    </div>
                  )}

                  {motivoPendencia === 'Aguardando' && (
                    <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 space-y-2">
                      <Label className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Textos Padrão - Aguardando</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Aguardando - Encerramento' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Aguardando - Encerramento')}
                        >
                          Encerramento
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Aguardando - Prazo Expirado' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Aguardando - Prazo Expirado')}
                        >
                          Prazo Expirado
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Aguardando - Próximo de Vencer' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Aguardando - Próximo de Vencer')}
                        >
                          Próximo de Vencer
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Aguardando - Encerrado' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Aguardando - Encerrado')}
                        >
                          Encerrado
                        </Button>
                      </div>
                    </div>
                  )}

                  {motivoPendencia === 'Entregue' && (
                    <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 space-y-2">
                      <Label className="text-sm font-medium text-green-800 dark:text-green-200">Textos Padrão - Entregue</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Entregue - Confirmação' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Entregue - Confirmação')}
                        >
                          Confirmação
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Entregue - Encerramento' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Entregue - Encerramento')}
                        >
                          Encerramento
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Entregue - Prazo Expirado' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Entregue - Prazo Expirado')}
                        >
                          Prazo Expirado
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Entregue - Próximo de Vencer' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Entregue - Próximo de Vencer')}
                        >
                          Próximo de Vencer
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Entregue - Encerrado' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoMotivoPendencia('Entregue - Encerrado')}
                        >
                          Encerrado
                        </Button>
                      </div>
                    </div>
                  )}

                  {motivoPendencia === 'Ag. Logística' && (
                    <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
                      <Label className="text-sm font-medium text-blue-800 dark:text-blue-200">Textos Padrão - Ag. Logística (Falha Produção)</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Falha Produção' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoPadrao('Falha Produção')}
                        >
                          Sem Rastreio
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Falha Produção - Correios' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoPadrao('Falha Produção - Correios')}
                        >
                          Rastreio Correios
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Falha Produção - Total Express' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoPadrao('Falha Produção - Total Express')}
                        >
                          Rastreio Total Express
                        </Button>
                      </div>
                    </div>
                  )}

                  {motivoPendencia === 'Ag. Compras' && (
                    <div className="mt-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-2">
                      <Label className="text-sm font-medium text-purple-800 dark:text-purple-200">Textos Padrão - Ag. Compras (Falha Compras)</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Falha Compras' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoPadrao('Falha Compras')}
                        >
                          Em Preparação
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Falha Compras - Em Separação' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoPadrao('Falha Compras - Em Separação')}
                        >
                          Em Separação
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Falha Compras - Cancelamento sem Estoque' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoPadrao('Falha Compras - Cancelamento sem Estoque')}
                        >
                          Cancelamento sem Estoque
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedMotivoPendencia === 'Falha Compras - Cancelado' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => loadTextoPadrao('Falha Compras - Cancelado')}
                        >
                          Cancelado
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <Label className={fieldErrors.anotacoes ? 'text-red-600' : ''}>
                    Anotações <span className="text-red-500">*</span>
                  </Label>
                  
                  {/* Campo para nova observação */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Textarea
                        id="nova-observacao"
                        placeholder="Digite uma nova observação..."
                        rows={2}
                        data-testid="textarea-nova-observacao"
                        className={fieldErrors.anotacoes && !formData.anotacoes ? 'border-red-500 focus:ring-red-500' : ''}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const input = e.target;
                            const novaObs = input.value.trim();
                            if (novaObs) {
                              const hoje = new Date().toLocaleDateString('pt-BR');
                              const novaEntrada = `[${hoje}] ${novaObs}`;
                              const anotacoesAtuais = formData.anotacoes;
                              const novasAnotacoes = anotacoesAtuais 
                                ? `${novaEntrada}\n\n${anotacoesAtuais}`
                                : novaEntrada;
                              handleChange('anotacoes', novasAnotacoes);
                              if (fieldErrors.anotacoes) setFieldErrors(prev => ({...prev, anotacoes: false}));
                              input.value = '';
                            }
                          }
                        }}
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="outline"
                      size="sm"
                      className="self-end"
                      onClick={() => {
                        const input = document.getElementById('nova-observacao');
                        const novaObs = input.value.trim();
                        if (novaObs) {
                          const hoje = new Date().toLocaleDateString('pt-BR');
                          const novaEntrada = `[${hoje}] ${novaObs}`;
                          const anotacoesAtuais = formData.anotacoes;
                          const novasAnotacoes = anotacoesAtuais 
                            ? `${novaEntrada}\n\n${anotacoesAtuais}`
                            : novaEntrada;
                          handleChange('anotacoes', novasAnotacoes);
                          input.value = '';
                        }
                      }}
                      data-testid="btn-adicionar-observacao"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {/* Histórico de anotações */}
                  {formData.anotacoes && (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border">
                      <Label className="text-xs text-muted-foreground mb-2 block">Histórico de Observações</Label>
                      <div className="text-sm whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300">
                        {formData.anotacoes}
                      </div>
                    </div>
                  )}

                  {/* Campo oculto para manter compatibilidade */}
                  <input type="hidden" value={formData.anotacoes} />
                </div>

                {/* Checkboxes Retornar Chamado e Verificar Adnéia */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="retornar-chamado"
                        checked={retornarChamado}
                        onChange={(e) => setRetornarChamado(e.target.checked)}
                        className="w-5 h-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                        data-testid="checkbox-retornar"
                      />
                      <Label htmlFor="retornar-chamado" className="text-amber-800 dark:text-amber-200 font-medium cursor-pointer">
                        Retornar Chamado
                      </Label>
                    </div>
                    {retornarChamado && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        Aguardando
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="verificar-adneia"
                        checked={verificarAdneia}
                        onChange={(e) => setVerificarAdneia(e.target.checked)}
                        className="w-5 h-5 rounded border-purple-400 text-purple-600 focus:ring-purple-500"
                        data-testid="checkbox-verificar-adneia"
                      />
                      <Label htmlFor="verificar-adneia" className="text-purple-800 dark:text-purple-200 font-medium cursor-pointer">
                        Verificar
                      </Label>
                    </div>
                    {verificarAdneia && (
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                        Aguardando
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex justify-between pb-6">
              <div>
                {isEditMode && formData.pendente !== false && (
                  <div className="flex flex-col gap-2">
                    <Button 
                      type="button" 
                      variant="destructive"
                      onClick={handleEncerrar}
                      disabled={loading || !MOTIVOS_FINALIZADORES.includes(motivoPendencia)}
                      data-testid="btn-encerrar"
                      title={!MOTIVOS_FINALIZADORES.includes(motivoPendencia) 
                        ? `Para encerrar, selecione um motivo finalizador: Entregue, Estornado, Atendido ou Em devolução` 
                        : 'Encerrar atendimento'}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Encerrar Atendimento
                    </Button>
                    {motivoPendencia && !MOTIVOS_FINALIZADORES.includes(motivoPendencia) && (
                      <p className="text-xs text-amber-600">
                        Motivo "{motivoPendencia}" não permite encerrar
                      </p>
                    )}
                  </div>
                )}
                {isEditMode && formData.pendente === false && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 py-2 px-4">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Atendimento Encerrado
                  </Badge>
                )}
              </div>
              <div className="flex gap-3 items-center">
                {/* Opção de encerrar ao criar (apenas para novos atendimentos) */}
                {!isEditMode && (
                  <div className="flex items-center gap-2 mr-4">
                    <input
                      type="checkbox"
                      id="encerrar-ao-criar"
                      checked={encerrarAoCriar}
                      onChange={(e) => setEncerrarAoCriar(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      data-testid="checkbox-encerrar"
                    />
                    <label htmlFor="encerrar-ao-criar" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Encerrar ao criar
                    </label>
                    {encerrarAoCriar && !MOTIVOS_FINALIZADORES.includes(motivoPendencia) && (
                      <span className="text-xs text-amber-600 ml-1">
                        (selecione um motivo finalizador)
                      </span>
                    )}
                  </div>
                )}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/chamados')}
                  data-testid="btn-cancelar"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading || (!isEditMode && encerrarAoCriar && !MOTIVOS_FINALIZADORES.includes(motivoPendencia))} 
                  size="lg" 
                  data-testid="btn-criar"
                  className={encerrarAoCriar && MOTIVOS_FINALIZADORES.includes(motivoPendencia) ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditMode ? 'Atualizando...' : encerrarAoCriar ? 'Criando e Encerrando...' : 'Criando...'}
                    </>
                  ) : (
                    <>
                      {encerrarAoCriar && <CheckCircle className="h-4 w-4 mr-2" />}
                      {isEditMode ? 'Atualizar Atendimento' : encerrarAoCriar ? 'Criar e Encerrar' : 'Criar Atendimento'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </form>
      )}

      {/* Dialog: Atendimento Existente */}
      <Dialog open={showExistingDialog} onOpenChange={setShowExistingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-600">Atendimento Existente</DialogTitle>
            <DialogDescription>
              Já existe um atendimento para esta entrega
            </DialogDescription>
          </DialogHeader>
          {existingAtendimento && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="font-medium">Solicitação: {existingAtendimento.solicitacao || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">Entrega: {existingAtendimento.numero_pedido}</p>
              <p className="text-sm text-muted-foreground">Categoria: {existingAtendimento.categoria}</p>
              <p className="text-sm text-muted-foreground">Status: {existingAtendimento.pendente ? 'Pendente' : 'Resolvido'}</p>
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowExistingDialog(false);
                if (existingAtendimento) {
                  navigate(`/chamados/editar/${existingAtendimento.id}`);
                }
              }}
            >
              Abrir Atendimento Existente
            </Button>
            <Button 
              onClick={() => setShowExistingDialog(false)}
            >
              Abrir Novo Atendimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Lista de Pedidos (quando CPF retorna múltiplos) */}
      <Dialog open={showPedidosDialog} onOpenChange={setShowPedidosDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecione o Pedido</DialogTitle>
            <DialogDescription>
              Foram encontrados {pedidosList.length} pedidos para este CPF
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {pedidosList.map(pedido => (
              <div 
                key={pedido.numero_pedido}
                className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => selectPedido(pedido)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Entrega #{pedido.numero_pedido}</p>
                    <p className="text-sm text-muted-foreground">{pedido.produto}</p>
                    <p className="text-xs text-muted-foreground">{pedido.data_status}</p>
                  </div>
                  <Badge className={getStatusBadgeColor(pedido.status_pedido)}>
                    {pedido.status_pedido}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Texto Padrão */}
      <Dialog open={showTextoDialog} onOpenChange={setShowTextoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Texto Padrão - {formData.categoria}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Textarea
              value={textoPadrao}
              readOnly
              rows={12}
              className="font-mono text-sm"
            />
            <Button 
              variant="outline" 
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(textoPadrao)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowTextoDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Devolução - Com seleção de status */}
      <Dialog open={showDevolucaoDialog} onOpenChange={setShowDevolucaoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              Registrar Devolução
            </DialogTitle>
            <DialogDescription>
              O atendimento será registrado na planilha <strong>Gestão Devoluções 2026_E</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Info do pedido */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Pedido:</strong> #{formData.numero_pedido}</p>
              <p><strong>Cliente:</strong> {pedidoErp?.nome_cliente || '-'}</p>
              <p><strong>Motivo:</strong> {formData.motivo || '-'}</p>
            </div>
            
            {/* Seleção de status */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Selecione o status do pedido:</p>
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 hover:bg-amber-50 hover:border-amber-300"
                  onClick={() => handleRegistrarDevolucaoComStatus('Aguardando')}
                  disabled={loading}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Aguardando</span>
                    <span className="text-xs text-muted-foreground">Aguardando retorno do produto</span>
                  </div>
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 hover:bg-green-50 hover:border-green-300"
                  onClick={() => handleRegistrarDevolucaoComStatus('Estornado')}
                  disabled={loading}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Estornado</span>
                    <span className="text-xs text-muted-foreground">Valor já foi estornado</span>
                  </div>
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 hover:bg-blue-50 hover:border-blue-300"
                  onClick={() => handleRegistrarDevolucaoComStatus('Reenviado')}
                  disabled={loading}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Reenviado</span>
                    <span className="text-xs text-muted-foreground">Novo produto foi enviado</span>
                  </div>
                </Button>
              </div>
            </div>
            
            {/* Info de preenchimento automático */}
            <div className="text-xs text-muted-foreground border-t pt-2">
              <p><strong>Devolvido por:</strong> {codigoReversa ? 'Correios (tem reversa)' : 'Transportadora (sem reversa)'}</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setShowDevolucaoDialog(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default NovoAtendimento;
