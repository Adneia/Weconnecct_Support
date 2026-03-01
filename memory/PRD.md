# Emergent - Sistema de Atendimentos WeConnect

## Problem Statement
Sistema de gestão de atendimentos para a equipe de atendimento da WeConnect, uma empresa de e-commerce. O sistema permite registrar atendimentos vinculados a pedidos, categorizá-los, e **sincronizar automaticamente com Google Sheets** para facilitar relatórios e compartilhamento.

## User Personas
1. **Letícia Martelo** - Atendente principal
2. **Adnéia Campos** - Atendente

## Core Requirements (Static)
- Registrar atendimentos vinculando ao número do pedido (Entrega)
- Buscar dados do pedido automaticamente na Base Emergent (~152k registros)
- Categorizar por 9 categorias: Falha Produção, Falha de Compras, Falha Transporte, Produto com Avaria, Divergência de Produto, Arrependimento, Dúvida, Reclamação, Assistência Técnica
- **Sincronização automática com Google Sheets** (planilha "Atendimentos 2026_E")
- Gestão de devoluções (Reversas)
- Autenticação JWT
- Temas claro e escuro

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python) + Motor (async MongoDB)
- **Database**: MongoDB
- **Integration**: Google Sheets API (Service Account)
- **Auth**: JWT-based authentication

## What's Been Implemented

### Google Sheets Integration (Mar 1, 2026) ✅
- **Module**: `/app/backend/google_sheets.py`
- **Service Account**: `atendimento-bot-emergent@emergent-atendimento.iam.gserviceaccount.com`
- **Spreadsheet Atendimentos**: `1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs`
- **Spreadsheet Devoluções**: `1dQbQWvG3Yv7Z6yqjivShK4-N4_pGXjs4x15jRMKVLno`
- Sincronização automática em background ao criar atendimento
- Endpoint de status: `GET /api/google-sheets/status`
- Badge visual no Dashboard mostrando conexão ativa

### Backend (server.py)
- ✅ User authentication (register/login/me)
- ✅ CRUD completo para Atendimentos com IDs sequenciais (ATD-2026-XXX)
- ✅ Busca de pedidos por Entrega ou CPF
- ✅ Import de Base Emergent via Excel (~152.000 registros)
- ✅ Dashboard statistics
- ✅ Textos padrão por categoria
- ✅ Google Sheets sync on create/update

### Frontend (React)
- ✅ Login com abas Entrar/Criar Conta
- ✅ Dashboard com badge de status Google Sheets
- ✅ Novo Atendimento com busca dinâmica de pedido
- ✅ Preenchimento automático de dados do cliente/pedido
- ✅ Lista de Atendimentos com filtros
- ✅ Gestão de Reversas
- ✅ Importar Base Emergent
- ✅ Tema claro/escuro

### Database Collections
- **users**: Usuários do sistema
- **chamados**: Atendimentos (vinculados a pedidos)
- **pedidos_erp**: Base Emergent (~152.608 pedidos)
- **reversas**: Processos de devolução
- **historico**: Log de ações

## API Endpoints Principais
- `POST /api/auth/login` - Login
- `POST /api/chamados` - Criar atendimento (sync Google Sheets)
- `GET /api/chamados` - Listar atendimentos
- `GET /api/pedidos-erp/{numero_pedido}` - Buscar pedido
- `GET /api/pedidos-erp/buscar/cpf/{cpf}` - Buscar por CPF
- `GET /api/google-sheets/status` - Status da conexão
- `POST /api/google-sheets/sync-all` - Sincronizar todos

## Credenciais de Teste
- Email: test@emergent.com
- Senha: test123

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Sistema de autenticação
- [x] CRUD de atendimentos
- [x] Dashboard com estatísticas
- [x] Importação Base Emergent (~152k registros)
- [x] **Integração Google Sheets**

### P1 - High Priority (Future)
- [ ] Fluxo completo de Devoluções (Reversas com gestão de galpão)
- [ ] Interface conversacional (estilo chatbot)
- [ ] API Correios para rastreio automático
- [ ] API Total Express para rastreio

### P2 - Medium Priority (Future)
- [ ] Integração Microsoft Graph (Outlook) para emails
- [ ] Integração Zendesk API
- [ ] Sugestão de categoria por IA
- [ ] Síntese automática por IA

### P3 - Nice to Have
- [ ] Relatórios avançados nativos
- [ ] Notificações em tempo real
- [ ] Exportação para Excel

## Test Reports
- `/app/test_reports/iteration_3.json` - 100% pass rate (backend + frontend)
