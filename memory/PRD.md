# Emergent - Sistema de Atendimentos WeConnect

## Problem Statement
Sistema de gestão de atendimentos para a equipe de atendimento da WeConnect.

## User Personas
- **Letícia Martelo** - Atendente
- **Adnéia Campos** - Atendente

## Busca de Pedidos (4 opções)
1. **CPF** - Busca por CPF do cliente
2. **Pedido** - Busca por pedido externo (pedido_cliente ou pedido_externo)
3. **Nome** - Busca por nome do cliente
4. **Entrega** - Busca por número de entrega

## Dados do Produto
- Nome do produto
- Marca
- **ID** (codigo_item_bseller)
- **SKU** (codigo_item_vtex - cód. terceiro)
- **Cód. Fornecedor** (codigo_fornecedor)
- Quantidade
- Valor

## Nota Fiscal (com Galpão)
- NF e **Galpão** na mesma linha
- Série 1 = SC | Série 2 = ES | Série 6 = SP
- Chave de acesso

## Textos Padrões

### Falha Produção (4 opções)
1. **Sem Rastreio** - "Pedido em separação para transportadora"
2. **Total Express** - Com link de rastreio
3. **J&T Express** - Com chave de acesso
4. **ASAP Log** - Com nota fiscal

### Falha de Compras
- Mesmo texto de "Sem Rastreio"

### Produto com Avaria (3 opções)
1. **Necessário Evidência** - Solicita fotos
2. **Transporte até R$250** - Novo envio sem devolução
3. **Reversa** - Código dos Correios

### Formato dos Textos
- Sempre começa com "Olá, Boa tarde."
- Sempre termina com "[ASSINATURA]" substituído pelo atendente

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Integration**: Google Sheets API (Service Account)

## API Endpoints
- `GET /api/pedidos-erp/buscar/cpf/{cpf}`
- `GET /api/pedidos-erp/buscar/pedido/{pedido}`
- `GET /api/pedidos-erp/buscar/nome/{nome}`
- `GET /api/pedidos-erp/{numero_pedido}`
- `POST /api/chamados`
- `GET /api/textos-padroes`

## What's Implemented ✅
- [x] Busca por CPF, Pedido, Nome, Entrega
- [x] Galpão na seção de Nota Fiscal (SC/SP/ES)
- [x] Produto com ID, SKU e Cód. Fornecedor
- [x] Textos Falha Produção (4 transportadoras)
- [x] Textos Avaria (3 opções)
- [x] Assinatura automática do atendente
- [x] Integração Google Sheets

## Backlog
- [ ] Fluxo completo de Devoluções
- [ ] Interface conversacional
- [ ] APIs de rastreio (Correios, Total Express)

## Credenciais de Teste
- Email: test@emergent.com
- Senha: test123

## Google Sheets
- **Service Account**: `atendimento-bot-emergent@emergent-atendimento.iam.gserviceaccount.com`
- **Atendimentos**: `1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs`
