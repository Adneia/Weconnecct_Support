# Textos padrao para atendimentos - Extraido de server.py

CATEGORIAS_EMERGENT = [
    "Falha Produção",
    "Falha Compras",
    "Falha Transporte",
    "Produto com Avaria",
    "Divergência de Produto",
    "Arrependimento",
    "Acompanhamento",
    "Assistência Técnica",
    "Falha de Integração"
]

STATUS_CLIENTE = [
    "Entregue", "Estornado", "Reenviado", "Aguardando Devolução",
    "Em Devolução", "Cancelado", "Resolvido", "Não Resolvido"
]

ATENDENTES = ["Letícia Martelo", "Adnéia Campos"]

CANAIS_DIARIOS = [
    "Reclame aqui", "ZAP/E-mail", "Mercado Livre", "LL Loyalty",
    "Sicredi", "CSU", "Nicequest", "GRS", "LTM", "Camicado",
    "Coopera", "Livelo", "Tudo Azul", "SENFF", "ShopHub", "Bradesco"
]

MOTIVOS_PENDENCIA_TEXTOS = [
    "Ag. Compras",
    "Ag. Logística",
    "Ag. Transportadora",
    "Ag. Parceiro",
    "Ag. Devolução",
    "Enviado",
    "Aguardando",
    "Ag. Confirmação da Entrega",
]

# Mapeamento de cada chave de texto para seu Motivo de Pendência
CATEGORIA_TO_MOTIVO = {
    # Falha Produção → Ag. Logística
    "Falha Produção": "Ag. Logística",
    "Falha Produção - Sem Rastreio": "Ag. Logística",
    "Falha Produção - Total Express": "Ag. Logística",
    "Falha Produção - J&T Express": "Ag. Logística",
    "Falha Produção - ASAP Log": "Ag. Logística",
    # Falha Compras → Ag. Compras
    "Falha Compras": "Ag. Compras",
    "Falha Compras - Em Separação": "Ag. Compras",
    "Falha Compras - Cancelamento sem Estoque": "Ag. Compras",
    "Falha Compras - Cancelado": "Ag. Compras",
    "Acompanhamento - Cancelamento por Falta": "Ag. Compras",
    "Acompanhamento - Ag. Compras": "Ag. Compras",
    "Acompanhamento - Problema Emissão NF": "Ag. Compras",
    # Falha Transporte → Ag. Transportadora
    "Falha Transporte": "Ag. Transportadora",
    "Acompanhamento - Em Processo Total Express": "Ag. Transportadora",
    "Acompanhamento - Em Processo J&T": "Ag. Transportadora",
    "Acompanhamento - Em Processo ASAP": "Ag. Transportadora",
    "Acompanhamento - Em Processo Correios": "Ag. Transportadora",
    "Insucesso na Entrega": "Ag. Transportadora",
    "Extravio - Reenvio": "Ag. Transportadora",
    "Extravio - Cancelamento": "Ag. Transportadora",
    "Processo de Entrega - Total Express": "Ag. Transportadora",
    "Processo de Entrega - J&T Express": "Ag. Transportadora",
    "Processo de Entrega - ASAP": "Ag. Transportadora",
    # Falha de Integração → Ag. Parceiro
    "Falha de Integração": "Ag. Parceiro",
    "Acompanhamento - Falha Integração": "Ag. Parceiro",
    # Assistência Técnica → Ag. Parceiro
    "Assistência Técnica": "Ag. Parceiro",
    "Assistência Técnica - Oderço": "Ag. Parceiro",
    "Assistência Técnica - Ventisol": "Ag. Parceiro",
    "Assistência Técnica - VENTISOL": "Ag. Parceiro",
    "Assistência Técnica - OEX": "Ag. Parceiro",
    "Assistência Técnica - Hoopson": "Ag. Parceiro",
    # Acompanhamento entrega → Ag. Parceiro
    "Acompanhamento - Entregue Possível Contestação": "Ag. Parceiro",
    "Acompanhamento - Entregue Contestação Expirada": "Ag. Parceiro",
    "Acompanhamento - Sem Comprovante Entrega": "Ag. Parceiro",
    "Comprovante de Entrega - Dentro do Prazo": "Ag. Parceiro",
    "Comprovante de Entrega - Expirado": "Ag. Parceiro",
    "Comprovante de Entrega - Expirado para Encerrar": "Ag. Parceiro",
    "Comprovante de Entrega - Email CSU": "Ag. Parceiro",
    "Comprovante de Entrega - Confirmação": "Ag. Parceiro",
    "Entregue - Encerramento": "Ag. Parceiro",
    "Entregue - Prazo Expirado": "Ag. Parceiro",
    "Entregue - Próximo de Vencer": "Ag. Parceiro",
    "Entregue - Encerrado": "Ag. Parceiro",
    "Entregue - Confirmação": "Ag. Parceiro",
    # Devolução / Avaria / Reversa → Ag. Devolução
    "Produto com Avaria": "Ag. Devolução",
    "Avaria - Necessário Evidência": "Ag. Devolução",
    "Avaria - Transporte até R$250": "Ag. Devolução",
    "Avaria - Reversa": "Ag. Devolução",
    "Divergência de Produto": "Ag. Devolução",
    "Arrependimento": "Ag. Devolução",
    "Assistência Técnica - Ventisol + Reversa": "Ag. Devolução",
    "Assistência Técnica - OEX + Reversa": "Ag. Devolução",
    "Reversa - Primeira Tentativa": "Ag. Devolução",
    "Reversa - Segunda Tentativa": "Ag. Devolução",
    "Em Devolução": "Ag. Devolução",
    "Em Devolução - Com Rastreio": "Ag. Devolução",
    "Devolvido - Problema Transportadora": "Ag. Devolução",
    "Devolvido - Cancelamento e Estorno": "Ag. Devolução",
    "Devolvido - Reenvio": "Ag. Devolução",
    "Falha Fornecedor - 1ª Reversa": "Ag. Devolução",
    "Falha Fornecedor - 2ª Reversa": "Ag. Devolução",
    "Aguardando - Encerramento": "Ag. Devolução",
    "Aguardando - Prazo Expirado": "Ag. Devolução",
    "Aguardando - Próximo de Vencer": "Ag. Devolução",
    "Aguardando - Encerrado": "Ag. Devolução",
    # Novos textos organizados por Motivo de Pendência (planilha revisada)
    "Ag. Compras - ATRASO - Em Preparação": "Ag. Compras",
    "Ag. Compras - ATRASO - Em Separação": "Ag. Compras",
    "Ag. Compras - Cancelamento": "Ag. Compras",
    "Ag. Logística - Atraso com Rastreio - Total Express": "Ag. Logística",
    "Ag. Logística - Atraso com Rastreio - J&T Express": "Ag. Logística",
    "Ag. Logística - Atraso com Rastreio - ASAP Log": "Ag. Logística",
    "Ag. Logística - Reenvio": "Ag. Logística",
    "Ag. Logística - ATRASO sem Rastreio - Em Preparação": "Ag. Logística",
    "Ag. Logística - ATRASO sem Rastreio - Em Separação": "Ag. Logística",
    "Ag. Logística - ATRASO sem Rastreio - Acionando Transportadora": "Ag. Logística",
    "Ag. Parceiro - Evidência": "Ag. Parceiro",
    "Ag. Parceiro - Cancelamento - Em Devolução": "Ag. Parceiro",
    "Ag. Parceiro - Cancelamento - Estorno e Descarte": "Ag. Parceiro",
    "Ag. Parceiro - Cancelamento - Devolução Exceção": "Ag. Parceiro",
    "Ag. Parceiro - Cancelamento - Confirmar Encerramento": "Ag. Parceiro",
    "Ag. Parceiro - Cancelamento - Código Expirado": "Ag. Parceiro",
    "Ag. Parceiro - Cancelamento - Avaria": "Ag. Parceiro",
    "Ag. Parceiro - Entregue - Confirmar": "Ag. Parceiro",
    "Ag. Parceiro - Entregue - Prazo Expirado": "Ag. Parceiro",
    "Ag. Parceiro - Entregue - Encerramento CSU": "Ag. Parceiro",
    "Ag. Parceiro - Integração - Vtex e CSU": "Ag. Parceiro",
    "Ag. Parceiro - Integração - Vtex e Parceiro": "Ag. Parceiro",
    "Ag. Parceiro - Assistência - Oderço": "Ag. Parceiro",
    "Ag. Parceiro - Assistência - Ventisol": "Ag. Parceiro",
    "Ag. Parceiro - Assistência - OEX": "Ag. Parceiro",
    "Ag. Parceiro - Assistência - Hoopson": "Ag. Parceiro",
    "Ag. Parceiro - Assistência - OEX Verificação": "Ag. Parceiro",
    "Ag. Parceiro - Extravio - Reenvio": "Ag. Parceiro",
    "Ag. Parceiro - Extravio - Cancelamento": "Ag. Parceiro",
    "Ag. Parceiro - Extravio - Novo Envio com Previsão": "Ag. Parceiro",
    "Enviado - Total Express": "Enviado",
    "Enviado - J&T Express": "Enviado",
    "Enviado - ASAP Log": "Enviado",
    "Enviado - Correios": "Enviado",
    "Aguardando - Reversa - Primeira Tentativa": "Aguardando",
    "Aguardando - Reversa - Segunda Tentativa": "Aguardando",
    "Aguardando - Reversa - Não Postado": "Aguardando",
    "Aguardando - Em Devolução - Sem Rastreio": "Aguardando",
    "Aguardando - Em Devolução - Com Rastreio": "Aguardando",
    "Aguardando - Em Devolução - Retorno Transportadora": "Aguardando",
    "Ag. Transportadora - Bloqueio - Acionado": "Ag. Transportadora",
    "Ag. Transportadora - Bloqueio - Aguardando Confirmação": "Ag. Transportadora",
    "Ag. Transportadora - Bloqueio - Em Rota": "Ag. Transportadora",
    "Ag. Transportadora - Acareação": "Ag. Transportadora",
    "Ag. Transportadora - Em Devolução - Sem Rastreio": "Ag. Transportadora",
    "Ag. Transportadora - Em Devolução - Com Rastreio": "Ag. Transportadora",
    "Ag. Transportadora - Em Devolução - Retorno Transportadora": "Ag. Transportadora",
    "Ag. Confirmação da Entrega - Solicitar Confirmação": "Ag. Confirmação da Entrega",
    "Ag. Confirmação da Entrega - Extravio": "Ag. Confirmação da Entrega",
    "Ag. Confirmação da Entrega - Reenvio": "Ag. Confirmação da Entrega",
    "Ag. Confirmação da Entrega - Confirmado": "Ag. Confirmação da Entrega",
}


def get_motivo_for_categoria(categoria: str) -> str:
    """Retorna o Motivo de Pendência associado a uma categoria de texto."""
    return CATEGORIA_TO_MOTIVO.get(categoria, "")


TEXTOS_PADROES = {
    "Falha Produção": """Selecione o tipo de resposta no campo abaixo.""",
    
    "Falha Produção - Sem Rastreio": """Olá, Boa tarde.

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em separação para transportadora. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Falha Produção - Total Express": """Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]

https://totalconecta.totalexpress.com.br/rastreamento

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Falha Produção - J&T Express": """Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]

https://www.jtexpress.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Falha Produção - ASAP Log": """Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]

https://rastreio.asaplog.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",
    
    "Falha Compras": """Olá,

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em preparação. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Falha Compras - Em Separação": """Olá,

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em separação para transportadora. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Falha Compras - Cancelamento sem Estoque": """Olá,

Infelizmente, durante a preparação do item "[PRODUTO]" ([ENTREGA]), identificamos uma avaria, o que nos levou a optar pelo cancelamento devido à indisponibilidade para reposição.

Poderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?

Atenciosamente,

[ASSINATURA]""",

    "Falha Compras - Cancelado": """Olá,

Pedido cancelado, por favor seguir com o estorno ao cliente e encerramento do chamado.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",
    
    "Falha Transporte": """Olá, Boa tarde.

Identificamos um problema na entrega do seu pedido. Pedimos desculpas pelo inconveniente.

Estamos em contato com a transportadora para resolver a situação.

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",
    
    "Produto com Avaria": """Selecione o tipo de avaria no campo abaixo.""",
    
    "Avaria - Necessário Evidência": """Olá, Boa tarde.

Para darmos continuidade à tratativa, solicitamos, por gentileza, o envio das seguintes evidências:

* Imagem da embalagem recebida;
* Foto da etiqueta entregue.
* Foto do produto (todos os ângulos)
* Foto ou vídeo que identifique a avaria

Ressaltamos que o prazo para acionar a transportadora é de 7 dias corridos após a entrega do produto avariado.

Estamos à disposição para quaisquer dúvidas e aguardamos seu retorno.
Atenciosamente,
[ASSINATURA]""",

    "Avaria - Transporte até R$250": """Olá, Boa tarde.

Informamos que iniciamos a preparação e o envio de um novo produto para o cliente.

Em caráter de exceção, não será necessário realizar a devolução do item avariado. Pedimos, por gentileza, que oriente o cliente quanto ao descarte adequado do produto.

Assim que possível, compartilharemos o link de rastreamento.

Permanecemos à disposição para qualquer dúvida.
Atenciosamente,
[ASSINATURA]""",

    "Avaria - Reversa": """Olá, Boa tarde.

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
[ASSINATURA]""",
    
    "Divergência de Produto": """Prezado(a) cliente,

Identificamos uma divergência entre o produto solicitado e o recebido.

Para verificação, solicitamos fotos do produto recebido e da etiqueta com código de barras.

Atenciosamente,
[ASSINATURA]""",
    
    "Arrependimento": """Prezado(a) cliente,

Recebemos sua solicitação de devolução por arrependimento.

Conforme o Código de Defesa do Consumidor, você tem até 7 dias para exercer o direito de arrependimento.

Segue abaixo o código de postagem para devolução:
[CÓDIGO_REVERSA]

Atenciosamente,
[ASSINATURA]""",
    
    "Acompanhamento": """Selecione o tipo de acompanhamento no campo abaixo.""",
    
    "Acompanhamento - Entregue Possível Contestação": """Olá, 

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Por favor confirmar entrega junto ao cliente.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Podemos encerrar o atendimento?

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Entregue Contestação Expirada": """Olá, 

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Encaminhamos em anexo o comprovante de entrega para sua conferência.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados a partir da data da entrega. Dessa forma, informamos que o prazo para solicitação de acareação já se encontra expirado.

Diante disso, prosseguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Sem Comprovante Entrega": """Olá,

Solicitamos o comprovante de entrega assinado ou o início do processo de acareação da entrega. Assim que possível, encaminharemos as informações.

Pedimos, por gentileza, que, ao entrar em contato com a cliente, seja solicitado que nos informe caso o pedido seja entregue.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Em Processo Total Express": """Olá, 

Pedido em processo de entrega, podendo ser entregue a qualquer momento. 

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

https://totalconecta.totalexpress.com.br/rastreamento

Seguimos a disposição. 
Atenciosamente, 
[ASSINATURA]""",

    "Acompanhamento - Em Processo J&T": """Olá, 

Pedido em processo de entrega, podendo ser entregue a qualquer momento. 

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]
Previsão de entrega até dia [DATA_PREVISAO]

https://www.jtexpress.com.br/

Seguimos a disposição. 
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Em Processo ASAP": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento. 

Acionado transportadora para seguir com a entrega com prioridade.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]
Previsão de entrega até dia [DATA_PREVISAO]

https://rastreio.asaplog.com.br/

Seguimos a disposição. 
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Em Processo Correios": """Olá, 

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue link para rastreio:
https://rastreamento.correios.com.br/app/index.php
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Cancelamento por Falta": """Olá, 

Infelizmente, durante a preparação do item [PRODUTO] ([ENTREGA]), identificamos uma avaria, o que nos levou a optar pelo cancelamento devido à indisponibilidade para reposição.

Poderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?

Atenciosamente, 
[ASSINATURA]""",

    "Acompanhamento - Falha Integração": """Olá,

Não fomos acionamos pela Vtex para preparação deste pedido. Status Vtex (Aguardando autorização para despachar).

Por favor verificar o ocorrido entre Vtex e ...

Seguimos a disposição. 
Atenciosamente,
[ASSINATURA]""",

    "Acompanhamento - Ag. Compras": """Olá, 

O pedido encontra-se em preparação. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente! 
[ASSINATURA]""",

    "Acompanhamento - Problema Emissão NF": """Olá,

Infelizmente na emissão da Nota fiscal do pedido acima [ENTREGA] - [PRODUTO], foi constatado um problema fiscal por parte do CNPJ informado o qual impede a aprovação da NF. Poderiam seguir com o cancelamento e estorno ao cliente.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",
    
    # Textos para Reclame Aqui
    "Reclame Aqui": """Selecione a resposta padrão no campo abaixo.""",
    
    "Reclame Aqui - Resposta Inicial": """Prezado(a) Sr(a). [NOME_CLIENTE],

Primeiramente, lamentamos muito pelo ocorrido.

Informamos que o atendimento para compras realizadas em nossa loja é conduzido diretamente pelos nossos parceiros. Nesse caso, o procedimento correto é acionar o canal de venda por meio do qual a compra foi efetuada, para apoio na tratativa da ocorrência.

No entanto, para agilizar a resolução do caso, entraremos em contato diretamente via WhatsApp, no número informado na nota fiscal, oferecendo o suporte necessário, além de acionarmos o parceiro responsável para dar continuidade às tratativas.

Continuamos à disposição para qualquer dúvida ou necessidade.

Atenciosamente,
Equipe de Atendimento Weconnect""",

    "Reclame Aqui - Mensagem WhatsApp": """Prezado(a) Sr(a). [NOME_CLIENTE]

Fomos acionados via Reclame Aqui com a informação de que o produto adquirido ainda não foi entregue.

Identificamos que o pedido, 

Nossas sinceras desculpas pelo ocorrido. Estamos à disposição para resolver o caso o mais breve possível.

Atenciosamente,
Equipe de Atendimento Weconnect""",

    "Reclame Aqui - Solicitar Encerramento": """Agradecemos a confirmação.

Por gentileza, poderia seguir com o encerramento da reclamação no Reclame Aqui?
Aproveitamos para agradecer, caso seja possível, a avaliação do nosso atendimento referente à tratativa da ocorrência.

Permanecemos à disposição.

Atenciosamente,
Equipe de Atendimento Weconnect""",

    "Reclame Aqui - Após Avaliação": """Prezado(a) Sr(a). [NOME_CLIENTE],

Agradecemos o retorno e a sua sincera avaliação em relação ao nosso atendimento.

Permanecemos à disposição para quaisquer dúvidas ou solicitações.

Atenciosamente,
Equipe de Atendimento Weconnect""",
    
    # Textos para Assistência Técnica
    "Assistência Técnica": """Selecione o fornecedor no campo abaixo.""",

    "Assistência Técnica - Oderço": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – ODERÇO
📞 44 2101-1428

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - Ventisol": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – VENTISOL
https://assistencia.ventisol.com.br/

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - OEX": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – OEX 
reversa@newex.com.br

📞 0800 887 0505 OU 11 973928421

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - Hoopson": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – Hoopson

📞 0+55 21 3809-2001

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - Ventisol + Reversa": """Olá, 

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
Atenciosamente!""",

    "Assistência Técnica - OEX + Reversa": """Olá, 

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

[ASSINATURA]""",

    # Textos específicos para situações
    "Reversa - Primeira Tentativa": """Olá,

Sentimos muito pelo ocorrido, poderia confirmar com o cliente se após a devolução seguiremos com reenvio ou cancelamento?

Referente à solicitação, segue os dados para realizar o retorno do produto em no máximo 10 dias.

Autorização de Postagem em Agência

Dados da Emissão:
Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor deve se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA

*** Orientações importantes ***:
* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto);
* Sem indícios de uso, sem violação do lacre original do fabricante;
* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios;
* Acompanhado também do comprovante de endereço do cliente, que deve estar legível;
* Informe que o produto tem 7 dias para dar entrada em nosso estoque para que possamos prosseguir com a tratativa.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Reversa - Segunda Tentativa": """Olá,

Referente à solicitação, segue os dados para realizar a segunda e última tentativa de retorno do produto em no máximo 7 dias.

Autorização de Postagem em Agência

Dados da Emissão:
Objeto: [CÓDIGO_REVERSA]
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor deve se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA

*** Orientações importantes ***:
* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto);
* Sem indícios de uso, sem violação do lacre original do fabricante;
* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios;
* Acompanhado também do comprovante de endereço do cliente, que deve estar legível;
* Informe que o produto tem 7 dias para dar entrada em nosso estoque para que possamos prosseguir com a tratativa.

⚠️ ATENÇÃO: Esta é a SEGUNDA e ÚLTIMA tentativa!

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Em Devolução": """Olá,

O pedido encontra-se em processo de devolução. Assim que recebido em nosso galpão, retornaremos com o atendimento.

Atenciosamente,
[ASSINATURA]""",

    "Em Devolução - Com Rastreio": """Olá,

O pedido segue em processo de devolução, conforme link de rastreamento abaixo:

Rastreio: [CÓDIGO_RASTREIO]
https://rastreamento.correios.com.br/app/index.php

Assim que o item der entrada em nosso galpão, daremos sequência à tratativa.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Insucesso na Entrega": """Bom dia!

Infelizmente, a transportadora direcionou o pedido para devolução, em razão de insucesso na entrega. No momento, o pedido encontra-se em retorno para o nosso galpão.

Lamentamos muito o ocorrido e os transtornos causados. Gostaríamos de saber se podemos prosseguir com um novo envio do produto assim que ele for recebido em nosso galpão.

Seguimos à disposição.
Atenciosamente,
Atendimento Weconnect""",

    "Estorno": """Olá,

Pedido cancelado, por favor seguir com o estorno ao cliente e encerramento do chamado.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Estorno com Descarte": """Olá,

Por favor seguir com o estorno ao cliente e encerramento do chamado.

Por favor orientar o cliente a descartar o item avariado.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Extravio - Reenvio": """Olá,

O pedido foi extraviado pela transportadora. Iniciamos a preparação para envio de um novo item ao cliente. Assim que possível, disponibilizaremos o link para rastreio.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Extravio - Cancelamento": """Olá, Bom dia.

Informamos que o item [PRODUTO] foi extraviado pela transportadora. Pedimos a gentileza de seguir com o cancelamento e estorno devido à indisponibilidade de reposição.

Pedimos sinceras desculpas pelo ocorrido.

Atenciosamente,
[ASSINATURA]""",

    "Processo de Entrega - Total Express": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]
https://totalconecta.totalexpress.com.br/rastreamento

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Processo de Entrega - J&T Express": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]
Previsão de entrega até dia [DATA_PREVISAO]
https://www.jtexpress.com.br/

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Processo de Entrega - ASAP": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Acionada transportadora para seguir com a entrega com prioridade.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]
Previsão de entrega até dia [DATA_PREVISAO]
https://rastreio.asaplog.com.br/

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - VENTISOL": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – VENTISOL
https://assistencia.ventisol.com.br/

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]""",

    "Assistência Técnica - OEX": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – OEX
reversa@newex.com.br
📞 0800 887 0505 OU 11 973928421

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]""",

    "Falha de Integração": """Olá,

Não fomos acionados pela Vtex para preparação deste pedido. Status Vtex (Aguardando autorização para despachar).

Por favor verificar o ocorrido entre Vtex e [PARCEIRO].

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Devolvido - Problema Transportadora": """Olá,

Lamentavelmente, o pedido está sendo devolvido ao nosso estoque devido a PROBLEMA OPERACIONAL da transportadora. Por gentileza, poderiam confirmar o endereço completo com ponto de referência para realização de um novo envio?

Nossas sinceras desculpas.

Seguimos a disposição.

Atenciosamente,

[ASSINATURA]""",

    "Devolvido - Cancelamento e Estorno": """Olá,

O pedido foi recebido em nosso galpão. Favor seguir com o cancelamento e estorno ao cliente.

Estamos à disposição para qualquer dúvida.

Atenciosamente,

[ASSINATURA]""",

    "Devolvido - Reenvio": """Olá,

Recebemos o pedido em nosso galpão e estamos providenciando o envio de um novo item ao cliente. Assim que possível, enviaremos o link de rastreamento.

Estamos à disposição para qualquer dúvida.

Atenciosamente,

[ASSINATURA]""",

    "Comprovante de Entrega - Dentro do Prazo": """Olá, 

Informamos que o pedido foi entregue em [DATA_ULTIMO_PONTO]. Por favor confirmar entrega junto ao cliente.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 15 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Podemos encerrar o atendimento?

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Comprovante de Entrega - Expirado": """Olá, 

Informamos que o pedido foi entregue em [DATA_ULTIMO_PONTO]. Encaminhamos em anexo o comprovante de entrega para sua conferência.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 15 dias corridos, contados a partir da data da entrega. Dessa forma, informamos que o prazo para solicitação de acareação já se encontra expirado.

Diante disso, prosseguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Comprovante de Entrega - Expirado para Encerrar": """Olá,

Informamos que o pedido foi entregue em [DATA_ULTIMO_PONTO]. Encaminhamos em anexo o comprovante de entrega para sua conferência.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 15 dias corridos, contados a partir da data da entrega. Dessa forma, daremos andamento à solicitação de acareação junto à transportadora e, assim que obtivermos um retorno, entraremos em contato.

Caso o cliente confirme a entrega com base no comprovante encaminhado, pedimos a gentileza de nos informar para que possamos prosseguir com o encerramento do chamado.

Permanecemos à disposição para quaisquer esclarecimentos.
Atenciosamente,
[ASSINATURA]""",

    "Comprovante de Entrega - Email CSU": """Olá, 

Informamos que o pedido foi entregue em [DATA_ULTIMO_PONTO]. Por favor confirmar entrega junto ao cliente e seguir com o encerramento do chamado. Comprovante enviado via e-mail.

Assunto: Ocorrência: [NUMERO_OCORRENCIA]

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 15 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Comprovante de Entrega - Confirmação": """Prezado(a) Sr(a). [PRIMEIRO_NOME]

Estamos entrando em contato para confirmar o recebimento do seu pedido: [PRODUTO] ([ENTREGA]). Poderia, por gentileza, nos informar se o produto já foi entregue?

1 - Sim
2 - Não

Aguardamos sua resposta.

Atenciosamente,
Equipe de Atendimento Weconnect""",

    "Falha Fornecedor - 1ª Reversa": """Olá, Boa tarde.

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
[ASSINATURA]""",

    "Falha Fornecedor - 2ª Reversa": """Olá, Boa tarde.

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
[ASSINATURA]""",

    "Aguardando - Encerramento": """Olá, 

Poderia confirmar se podemos proceder com o encerramento do chamado?

Seguimos a disposição.
Atenciosamente, 
[ASSINATURA]""",

    "Aguardando - Prazo Expirado": """Olá, 

O código de postagem está expirado e não houve postagem do produto. Podemos seguir com o encerramento do atendimento?

Seguimos à disposição.
Atenciosamente, 
[ASSINATURA]""",

    "Aguardando - Próximo de Vencer": """Olá,

Objeto não postado até o momento. Por favor orientar o cliente em relação ao prazo que expira em [DATA_VALIDADE].

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Aguardando - Encerrado": """Olá, Bom dia.

Estamos seguindo com o encerramento do pedido como entregue.

Seguimos a disposição, caso haja qualquer necessidade dentro dos prazo de atuação.
Atenciosamente!
[ASSINATURA]""",

    "Entregue - Encerramento": """Olá,

Poderia confirmar se podemos proceder com o encerramento do chamado?

Seguimos a disposição.

Atenciosamente,

[ASSINATURA]""",

    "Entregue - Prazo Expirado": """Olá,

O código de postagem está expirado e não houve postagem do produto. Podemos seguir com o encerramento do atendimento?

Seguimos à disposição.

Atenciosamente,

[ASSINATURA]""",

    "Entregue - Próximo de Vencer": """Olá,

Objeto não postado até o momento. Por favor orientar o cliente em relação ao prazo que expira em [DATA_VALIDADE].

Seguimos a disposição.

Atenciosamente!

[ASSINATURA]""",

    "Entregue - Encerrado": """Olá, Bom dia.

Estamos seguindo com o encerramento do pedido como entregue.

Seguimos a disposição, caso haja qualquer necessidade dentro dos prazo de atuação.

Atenciosamente!
[ASSINATURA]""",

    "Entregue - Confirmação": """Prezado(a) Sr(a). [NOME_CLIENTE]

Estamos entrando em contato para confirmar o recebimento do seu pedido: [PRODUTO] ([NUMERO_PEDIDO]). Poderia, por gentileza, nos informar se o produto já foi entregue?

1 - Sim
2 - Não

Aguardamos sua resposta.

Atenciosamente,
Equipe de Atendimento Weconnect""",

    # ============================================================
    # NOVOS TEXTOS PADRÕES — Organizados por Motivo de Pendência
    # Fonte: Planilha revisada (março/2026)
    # ============================================================

    # --- Ag. Compras ---
    "Ag. Compras - ATRASO - Em Preparação": """Olá,

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em preparação. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Ag. Compras - ATRASO - Em Separação": """Olá,

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em separação para transportadora. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Ag. Compras - Cancelamento": """Olá,

Infelizmente, durante a preparação do item [PRODUTO] ([ENTREGA]), identificamos uma avaria, o que nos levou a optar pelo cancelamento devido à indisponibilidade para reposição.

Poderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?

Atenciosamente,
[ASSINATURA]""",

    # --- Ag. Logística ---
    "Ag. Logística - Atraso com Rastreio - Total Express": """Olá,

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]

https://totalconecta.totalexpress.com.br/rastreamento

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Logística - Atraso com Rastreio - J&T Express": """Olá,

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]

https://www.jtexpress.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Logística - Atraso com Rastreio - ASAP Log": """Olá,

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]

https://rastreio.asaplog.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Logística - Reenvio": """Olá,

Recebemos o pedido em nosso galpão e estamos providenciando o envio de um novo item ao cliente. Assim que possível, enviaremos o link de rastreamento.

Estamos à disposição para qualquer dúvida.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Logística - ATRASO sem Rastreio - Em Preparação": """Olá,

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em preparação. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Ag. Logística - ATRASO sem Rastreio - Em Separação": """Olá,

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em separação para transportadora. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Ag. Logística - ATRASO sem Rastreio - Acionando Transportadora": """Olá,

Acionaremos a transportadora para verificar o motivo do atraso no processamento do pedido.

Prazo de até 3 dias uteis. Assim que obtivermos retorno, entraremos em contato.

Por favor seguir acompanhando o rastreio para novas atualizações.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    # --- Ag. Parceiro ---
    "Ag. Parceiro - Evidência": """Olá,

Para darmos continuidade à tratativa, solicitamos, por gentileza, o envio das seguintes evidências:

* Imagem da embalagem recebida;
* Foto da etiqueta entregue.
* Foto do produto (todos os ângulos)
* Foto ou vídeo que identifique a avaria

Ressaltamos que o prazo para acionar a transportadora é de 7 dias corridos após a entrega do produto avariado.

Estamos à disposição para quaisquer dúvidas e aguardamos seu retorno.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Cancelamento - Em Devolução": """Olá,

O pedido encontra-se em processo de devolução. Assim que recebido em nosso galpão, retornaremos com o atendimento.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Cancelamento - Estorno e Descarte": """Olá,

Por favor seguir com o estorno ao cliente e encerramento do chamado.

Por favor orientar o cliente descartar o item avariado.

Sentimos muito pelo ocorrido.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Cancelamento - Devolução Exceção": """Olá,

Pedido em processo de devolução. Em caráter de exceção, por favor seguir com o estorno ao cliente.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Cancelamento - Confirmar Encerramento": """Olá,

Poderia confirmar se podemos proceder com o encerramento do chamado?

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Cancelamento - Código Expirado": """Olá,

O código de postagem está expirado e não houve postagem do produto. Podemos seguir com o encerramento do atendimento?

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Cancelamento - Avaria": """Olá,

Infelizmente, durante a preparação do item [PRODUTO] ([ENTREGA]), identificamos uma avaria, o que nos levou a optar pelo cancelamento devido à indisponibilidade para reposição.

Poderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?

Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Entregue - Confirmar": """Olá,

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Por favor confirmar entrega junto ao cliente.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 15 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Podemos encerrar o atendimento?

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Entregue - Prazo Expirado": """Olá,

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Encaminhamos em anexo o comprovante de entrega para sua conferência.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 15 dias corridos, contados a partir da data da entrega. Dessa forma, informamos que o prazo para solicitação de acareação já se encontra expirado.

Diante disso, prosseguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Entregue - Encerramento CSU": """Olá,

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Por favor confirmar entrega junto ao cliente e seguir com o encerramento do chamado. Comprovante enviado via e-mail.

Assunto: Ocorrência: [NUMERO_OCORRENCIA]

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 15 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Integração - Vtex e CSU": """Olá,

Não fomos acionados pela Vtex para preparação deste pedido. Status Vtex (Aguardando autorização para despachar).

Por favor verificar o ocorrido entre Vtex e CSU.

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Integração - Vtex e Parceiro": """Olá,

Não fomos acionados pela Vtex para preparação deste pedido. Status Vtex (Aguardando autorização para despachar).

Por favor verificar o ocorrido entre Vtex e [PARCEIRO].

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Assistência - Oderço": """Olá,

Lamentamos muito pelo ocorrido com o produto.

Para dar andamento da forma mais rápida possível, o cliente pode optar por uma das opções abaixo:

1️⃣ Acionar diretamente o fornecedor, que poderá conduzir o processo de troca com mais agilidade:
Serviço de Atendimento ao Cliente (SAC) – ODERÇO
📞 44 2101-1428

2️⃣ Caso prefira, podemos seguir com a abertura de logística reversa, para que o produto retorne ao nosso galpão e, após a conferência, seja realizado o reenvio de um novo item ou o prosseguimento com a devolução, conforme solicitado.

Por gentileza, nos informe qual das opções prefere para que possamos dar sequência ao atendimento.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Assistência - Ventisol": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – VENTISOL
https://assistencia.ventisol.com.br/

Seguimos à disposição para qualquer apoio necessário.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Assistência - OEX": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – OEX
reversa@newex.com.br

📞 0800 887 0505 OU 11 973928421

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Assistência - Hoopson": """Olá,

Lamentamos muito pelo ocorrido e para agilizar o atendimento, pedimos que o cliente acione direto o fornecedor para dar andamento ao processo de troca.

Serviço de Atendimento ao Cliente (SAC) – Hoopson

📞 0+55 21 3809-2001

Seguimos à disposição para qualquer apoio necessário.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Assistência - OEX Verificação": """Olá, boa tarde.

Temos esta orientação pelo fornecedor, pois algumas conexões não são realizadas corretamente.

Pedimos, por gentileza, que o cliente seja orientado a entrar em contato com a assistência, para que possam auxiliá-lo com um teste rápido de verificação de funcionamento.

Dados da assistência técnica:
Serviço de Atendimento ao Cliente (SAC) – OEX

(11) 97392-8421 (WhatsApp)
📞 0800 887 0505
📧 reversa@newex.com.br

Caso não haja retorno ou suporte no prazo de até 2 dias úteis, por favor nos acionar, pois daremos continuidade à tratativa internamente pela loja, seguindo com a troca ou devolução do item.

Permanecemos à disposição para resolver o mais breve possível.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Extravio - Reenvio": """Olá,

O pedido foi extraviado pela transportadora. Iniciamos a preparação para envio de um novo item ao cliente, assim que possível disponibilizaremos o link para rastreio.

Seguimos a disposição.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Extravio - Cancelamento": """Olá,

O pedido foi extraviado pela transportadora. Pedimos a gentileza de seguir com o cancelamento e estorno devido a indisponibilidade de reposição.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Parceiro - Extravio - Novo Envio com Previsão": """Olá,

O pedido foi extraviado pela transportadora, iniciamos uma nova preparação para envio ao cliente. A previsão atual de entrega é para o dia [DATA_PREVISAO]. Poderia, por gentileza, confirmar junto ao cliente a nova previsão?

Pedimos a gentileza de solicitar ao cliente que em caso de entrega nos acione para darmos as devidas tratativas.

Atenciosamente,
[ASSINATURA]""",

    # --- Enviado ---
    "Enviado - Total Express": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

https://totalconecta.totalexpress.com.br/rastreamento

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Enviado - J&T Express": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]
Previsão de entrega até dia [DATA_PREVISAO]

https://www.jtexpress.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Enviado - ASAP Log": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Acionado transportadora para seguir com a entrega com prioridade.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]
Previsão de entrega até dia [DATA_PREVISAO]

https://rastreio.asaplog.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    "Enviado - Correios": """Olá,

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Acionado transportadora para seguir com a entrega com prioridade.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

https://rastreamento.correios.com.br/app/index.php

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]""",

    # --- Aguardando ---
    "Aguardando - Reversa - Primeira Tentativa": """Olá,

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
[ASSINATURA]""",

    "Aguardando - Reversa - Segunda Tentativa": """Olá,

Referente a solicitação, segue os dados para realizar a segunda e última tentativa de retorno do produto em no máximo 7 dias.

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
[ASSINATURA]""",

    "Aguardando - Reversa - Não Postado": """Olá,

Objeto não postado até o momento. Por favor orientar o cliente em relação ao prazo que expira em [DATA_VALIDADE].

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Aguardando - Em Devolução - Sem Rastreio": """Olá,

O pedido encontra-se em processo de devolução. Assim que recebido em nosso galpão, retornaremos com o atendimento.

Atenciosamente,
[ASSINATURA]""",

    "Aguardando - Em Devolução - Com Rastreio": """Olá,

O pedido segue em processo de devolução, conforme link de rastreamento abaixo:

Rastreio: [CÓDIGO_REVERSA]

https://rastreamento.correios.com.br/app/index.php

Assim que o item der entrada em nosso galpão, daremos sequência à tratativa.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Aguardando - Em Devolução - Retorno Transportadora": """Olá,

Infelizmente, a transportadora direcionou o pedido para devolução. No momento, o pedido encontra-se em retorno para o nosso galpão.

Lamentamos muito o ocorrido e os transtornos causados. Gostaríamos de saber se podemos prosseguir com um novo envio do produto assim que ele for recebido em nosso galpão.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    # --- Ag. Transportadora ---
    "Ag. Transportadora - Bloqueio - Acionado": """Olá,

Acionamos a transportadora com o bloqueio de entrega. Poderia, por favor orientar o cliente que em caso de tentativa de entrega, recusar o recebimento.

Assim que entrar em devolução, entraremos em contato.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]""",

    "Ag. Transportadora - Bloqueio - Aguardando Confirmação": """Olá,

O pedido está em processo de separação pela transportadora, aguardando a confirmação da solicitação de barragem.

Prazo para retorno até 3 dias uteis. Assim que tivermos o retorno, entraremos em contato.

Permanecemos à disposição.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Transportadora - Bloqueio - Em Rota": """Olá,

Acionamos a transportadora com a solicitação de bloqueio da entrega. No entanto, identificamos que o pedido encontra-se em rota de entrega, o que significa que pode não ser possível impedir a entrega a tempo.

Por gentileza, oriente o cliente a recusar o recebimento, caso a tentativa de entrega ocorra.

Caso a entrega seja concluída, nos acionar novamente para que possamos seguir com a emissão da reversa para devolução do pedido.

Assim que o pedido retornar ao nosso centro de distribuição, entraremos em contato.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Transportadora - Acareação": """Olá,

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Encaminhamos em anexo o comprovante de entrega para sua conferência.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 15 dias corridos, contados a partir da data da entrega. Dessa forma, daremos andamento à solicitação de acareação junto à transportadora e, assim que obtivermos um retorno, entraremos em contato.

Caso o cliente confirme a entrega com base no comprovante encaminhado, pedimos a gentileza de nos informar para que possamos prosseguir com o encerramento do chamado.

Permanecemos à disposição para quaisquer esclarecimentos.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Transportadora - Em Devolução - Sem Rastreio": """Olá,

O pedido encontra-se em processo de devolução. Assim que recebido em nosso galpão, retornaremos com o atendimento.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Transportadora - Em Devolução - Com Rastreio": """Olá,

O pedido segue em processo de devolução, conforme link de rastreamento abaixo:

Rastreio: [CÓDIGO_REVERSA]

https://rastreamento.correios.com.br/app/index.php

Assim que o item der entrada em nosso galpão, daremos sequência à tratativa.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Transportadora - Em Devolução - Retorno Transportadora": """Olá,

Infelizmente, a transportadora direcionou o pedido para devolução. No momento, o pedido encontra-se em retorno para o nosso galpão.

Lamentamos muito o ocorrido e os transtornos causados. Gostaríamos de saber se podemos prosseguir com um novo envio do produto assim que ele for recebido em nosso galpão.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]""",

    # --- Ag. Confirmação da Entrega ---
    "Ag. Confirmação da Entrega - Solicitar Confirmação": """Prezado(a) Sr(a). [PRIMEIRO_NOME]

Estamos entrando em contato para confirmar o recebimento do seu pedido: [PRODUTO] ([ENTREGA]). Poderia, por gentileza, nos informar se o produto já foi entregue?

1 - Sim
2 - Não

Aguardamos sua resposta.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Confirmação da Entrega - Extravio": """Agradecemos pelo retorno e lamentamos pelo ocorrido.

Não recebemos a confirmação de entrega por parte da transportadora, e por isso consideramos o pedido extraviado.

Por gentileza, poderia confirmar o endereço de entrega e ponto de referência para o reenvio?

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]""",

    "Ag. Confirmação da Entrega - Reenvio": """Seguiremos com um novo envio do pedido.

Solicitaremos prioridade na entrega.

Muito obrigada pelo retorno.

Atenciosamente,
[ASSINATURA]""",

    "Ag. Confirmação da Entrega - Confirmado": """Agradecemos a confirmação.

Atenciosamente,
[ASSINATURA]"""
}
