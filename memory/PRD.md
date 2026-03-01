# Emergent - Sistema de Atendimentos WeConnect

## Problem Statement
Sistema de gestão de atendimentos para a equipe de atendimento da WeConnect, uma empresa de e-commerce. O sistema permite registrar atendimentos vinculados a pedidos, categorizá-los, e **sincronizar automaticamente com Google Sheets**.

## User Personas
1. **Letícia Martelo** - Atendente principal
2. **Adnéia Campos** - Atendente

## Core Requirements (Static)
- Registrar atendimentos vinculando ao número do pedido (Entrega)
- Buscar dados do pedido por **Entrega, CPF ou Nome do cliente**
- Identificar **Galpão** automaticamente pela série da NF (1=SC, 6=SP, 2=ES)
- Categorizar por 9 categorias + textos situacionais
- **Sincronização automática com Google Sheets**
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

### Busca e Galpão (Mar 1, 2026) ✅
- **Busca por Entrega, CPF ou Nome** do cliente
- **Identificação automática do Galpão** pela série da NF extraída da chave de acesso:
  - Série 1 = Santa Catarina (SC)
  - Série 6 = São Paulo (SP)
  - Série 2 = Espírito Santo (ES)
- Badge visual mostrando Galpão no card do pedido

### Textos Padrões (Mar 1, 2026) ✅
**Categorias principais:**
- Falha Produção, Falha de Compras, Falha Transporte
- Produto com Avaria, Divergência de Produto
- Arrependimento, Dúvida, Reclamação, Assistência Técnica

**Situações específicas:**
- Reversa (1ª e 2ª tentativa)
- Em Devolução (simples e com rastreio)
- Insucesso na Entrega
- Estorno (simples e com descarte)
- Extravio (Reenvio e Cancelamento)
- Processo de Entrega (Total Express, J&T, ASAP)
- Assistência Técnica (VENTISOL, OEX)

### Google Sheets Integration (Mar 1, 2026) ✅
- **Module**: `/app/backend/google_sheets.py`
- **Service Account**: `atendimento-bot-emergent@emergent-atendimento.iam.gserviceaccount.com`
- **Spreadsheet Atendimentos**: `1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs`
- **Spreadsheet Devoluções**: `1dQbQWvG3Yv7Z6yqjivShK4-N4_pGXjs4x15jRMKVLno`

### Backend (server.py)
- ✅ User authentication (register/login/me)
- ✅ CRUD completo para Atendimentos com IDs sequenciais (ATD-2026-XXX)
- ✅ Busca de pedidos por Entrega, CPF ou Nome
- ✅ Import de Base Emergent via Excel (~152.000 registros)
- ✅ Dashboard statistics
- ✅ Textos padrão por categoria E situação
- ✅ Google Sheets sync on create/update
- ✅ Identificação automática do Galpão pela série da NF

### Frontend (React)
- ✅ Login com abas Entrar/Criar Conta
- ✅ Dashboard com badge de status Google Sheets
- ✅ Novo Atendimento com busca por Entrega/CPF/Nome
- ✅ Preenchimento automático de dados do cliente/pedido/galpão
- ✅ Badge de Galpão (SC/SP/ES)
- ✅ Lista de Atendimentos com filtros
- ✅ Gestão de Reversas
- ✅ Importar Base Emergent
- ✅ Tema claro/escuro

## API Endpoints Principais
- `POST /api/auth/login` - Login
- `POST /api/chamados` - Criar atendimento (sync Google Sheets)
- `GET /api/chamados` - Listar atendimentos
- `GET /api/pedidos-erp/{numero_pedido}` - Buscar por Entrega
- `GET /api/pedidos-erp/buscar/cpf/{cpf}` - Buscar por CPF
- `GET /api/pedidos-erp/buscar/nome/{nome}` - Buscar por Nome
- `GET /api/textos-padroes` - Textos por categoria
- `GET /api/textos-situacionais` - Textos situacionais
- `GET /api/google-sheets/status` - Status da conexão

## Credenciais de Teste
- Email: test@emergent.com
- Senha: test123

## Mapeamento de Galpão
| Série NF | Galpão | UF |
|----------|--------|-----|
| 1 | Santa Catarina | SC |
| 2 | Espírito Santo | ES |
| 6 | São Paulo | SP |

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Sistema de autenticação
- [x] CRUD de atendimentos
- [x] Dashboard com estatísticas
- [x] Importação Base Emergent (~152k registros)
- [x] **Integração Google Sheets**
- [x] **Busca por Entrega, CPF ou Nome**
- [x] **Identificação do Galpão pela série NF**
- [x] **Textos padrões completos (categorias + situações)**

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
