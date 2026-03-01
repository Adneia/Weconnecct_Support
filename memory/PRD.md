# Emergent - Sistema de Atendimentos WeConnect

## Funcionalidades Implementadas

### Busca de Pedidos (4 opções)
- CPF, Pedido (externo), Nome, Entrega

### Auto-preenchimento
- Categoria baseada no status do pedido
- Transportadora detectada automaticamente
- Motivo da pendência sugerido

### Categorias com Textos Específicos

#### Falha Transporte
**Enviar Rastreio** (detecta transportadora):
- Total Express
- J&T Express  
- ASAP Log
- Correios

**Bloqueio de Entrega:**
- Bloqueio OK
- Não é Possível (em rota)

**Extravio:**
- Extravio simples
- Com Previsão de nova entrega
- Com Cancelamento (inclui produto e entrega)

**Comprovante de Entrega:**
- Falta Comprovante
- Desconhece Entrega - No Prazo (até 15 dias)
- Desconhece Entrega - Fora do Prazo (+15 dias)
- CSU - Comprovante Email (aparece quando canal=CSU)

#### Falha Produção
- Sem Rastreio
- Com Rastreio (Total/J&T/ASAP)

#### Produto com Avaria
- Necessário Evidência
- Transporte até R$250
- Reversa

### Bloco 3 - Anotações
- **Motivo da Pendência** (dropdown)
  - Ag. Compras, Ag. Logística, Enviado
  - Ag. Bseller, Ag. Barrar, Aguardando, Em devolução
- Status atual do pedido exibido
- Campo de anotações livre

### Dados do Produto
- ID (codigo_item_bseller)
- SKU (cód. terceiro)
- Cód. Fornecedor
- Marca, Qtde, Valor

### Nota Fiscal + Galpão
- NF e Galpão na mesma linha
- Série 1=SC, 2=ES, 6=SP

### Placeholders nos Textos
- [ASSINATURA] → Nome do atendente
- [PRODUTO] → Nome do produto
- [ENTREGA] → Número da entrega
- [NOTA_FISCAL], [CHAVE_ACESSO], [CÓDIGO_RASTREIO]
- [DATA_ENTREGA], [DATA_PREVISAO]
- [NUMERO_OCORRENCIA]

## Credenciais de Teste
- Email: test@emergent.com
- Senha: test123

## Google Sheets
- Service Account: `atendimento-bot-emergent@emergent-atendimento.iam.gserviceaccount.com`
- Atendimentos: `1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs`
