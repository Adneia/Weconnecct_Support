# Emergent - Sistema de Atendimentos WeConnect

## Problem Statement
Sistema de gestão de atendimentos para a equipe de atendimento da WeConnect. Permite registrar atendimentos vinculados a pedidos e **sincronizar com Google Sheets**.

## User Personas
1. **Letícia Martelo** - Atendente
2. **Adnéia Campos** - Atendente

## Core Requirements

### Busca de Pedidos (4 opções)
1. **CPF** - Busca por CPF do cliente
2. **Pedido** - Busca por pedido externo (pedido_cliente ou pedido_externo)
3. **Nome** - Busca por nome do cliente
4. **Entrega** - Busca por número de entrega

### Identificação do Galpão
- Série 1 = **SC**
- Série 2 = **ES**
- Série 6 = **SP**
- Exibição simplificada: "Galpão: SC/SP/ES"

### Dados do Produto
- Nome do produto
- Marca
- **Cód. Fornecedor**
- **SKU SIGE** (codigo_item_bseller)
- Quantidade
- Valor

### Textos de Avaria (3 opções)
1. **Necessário Evidência** - Solicita fotos da embalagem, etiqueta, produto e avaria
2. **Transporte até R$250** - Novo envio sem devolução, orientar descarte
3. **Reversa** - Processo de devolução com código dos Correios

### Assinatura Automática
- Textos padrões incluem `[ASSINATURA]`
- Substituído automaticamente pelo nome do atendente selecionado

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Integration**: Google Sheets API (Service Account)

## API Endpoints
- `GET /api/pedidos-erp/buscar/cpf/{cpf}` - Busca por CPF
- `GET /api/pedidos-erp/buscar/pedido/{pedido}` - Busca por pedido externo
- `GET /api/pedidos-erp/buscar/nome/{nome}` - Busca por nome
- `GET /api/pedidos-erp/{numero_pedido}` - Busca por entrega
- `GET /api/textos-padroes` - Textos por categoria
- `GET /api/textos-situacionais` - Textos situacionais
- `POST /api/chamados` - Criar atendimento (sync Google Sheets)

## What's Implemented ✅
- [x] Sistema de autenticação JWT
- [x] CRUD de atendimentos (ATD-2026-XXX)
- [x] Busca por CPF, Pedido, Nome, Entrega
- [x] Identificação do Galpão (SC/SP/ES)
- [x] Exibição SKU SIGE e Cód. Fornecedor
- [x] Textos de Avaria (3 tipos)
- [x] Assinatura automática do atendente
- [x] Integração Google Sheets
- [x] Dashboard com estatísticas

## Prioritized Backlog

### P1 - High Priority
- [ ] Fluxo completo de Devoluções (gestão de galpão)
- [ ] Interface conversacional

### P2 - Medium Priority
- [ ] Integração APIs de rastreio (Correios, Total Express)
- [ ] Integração Outlook/Zendesk

### P3 - Nice to Have
- [ ] Sugestão de categoria por IA
- [ ] Relatórios avançados

## Credenciais de Teste
- Email: test@emergent.com
- Senha: test123

## Google Sheets
- **Service Account**: `atendimento-bot-emergent@emergent-atendimento.iam.gserviceaccount.com`
- **Atendimentos**: `1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs`
- **Devoluções**: `1dQbQWvG3Yv7Z6yqjivShK4-N4_pGXjs4x15jRMKVLno`
