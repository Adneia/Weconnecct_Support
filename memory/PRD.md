# WeConnect Support - Sistema de Controle de Chamados

## Problem Statement
Sistema de controle de chamados para a equipe de atendimento da WeConnect, uma empresa de e-commerce. O sistema é usado por 2-3 atendentes que gerenciam aproximadamente 20 chamados por dia.

## User Personas
1. **Atendente WeConnect** - Usuário principal que registra, acompanha e resolve chamados de clientes
2. **Gestor de Atendimento** - Supervisiona métricas e desempenho da equipe

## Core Requirements (Static)
- Registrar chamados vinculando ao número do pedido
- Categorizar tipo de problema (Acompanhamento, Falha de Compras, Falha de Produção, Falha de Transporte, Reversa, Outro)
- Acompanhar diariamente até a resolução
- Gerenciar processos de reversa (devolução via Correios)
- Importação manual de dados do ERP via CSV/Excel
- Autenticação JWT com login/registro
- Temas claro e escuro

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT-based authentication

## What's Been Implemented (Jan 30, 2026)

### Backend (server.py)
- ✅ User authentication (register/login/me endpoints)
- ✅ CRUD completo para Chamados
- ✅ CRUD para Reversas
- ✅ CRUD para Histórico de atendimento
- ✅ Import de Pedidos ERP via CSV/Excel
- ✅ Dashboard statistics (métricas, gráficos 7 dias)
- ✅ Filtros avançados por status, categoria, canal, responsável

### Frontend (React)
- ✅ Página de Login com abas Entrar/Criar Conta
- ✅ Dashboard com cards de métricas e gráfico de barras
- ✅ Formulário Novo Chamado com busca de pedido no ERP
- ✅ Lista de Chamados com filtros e ordenação
- ✅ Detalhes do Chamado com edição, histórico timeline
- ✅ Gestão de Reversas com estatísticas e alertas
- ✅ Importar Pedidos com drag & drop e preview
- ✅ Tema claro/escuro com toggle
- ✅ Layout responsivo (mobile-friendly)

### Tabelas MongoDB
- users - Usuários do sistema
- chamados - Chamados de atendimento
- pedidos_erp - Dados importados do ERP
- reversas - Processos de devolução
- historico - Log de ações por chamado

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Sistema de autenticação
- [x] CRUD de chamados
- [x] Dashboard básico
- [x] Importação manual de pedidos

### P1 - High Priority (Future)
- [ ] Integração SharePoint via Microsoft Graph API
- [ ] API Correios para rastreio automático de reversas
- [ ] API Total Express para rastreio

### P2 - Medium Priority (Future)
- [ ] Integração Microsoft Graph (Outlook) para captura de emails
- [ ] Integração Zendesk API
- [ ] Sugestão de categoria por IA
- [ ] Síntese automática por IA

### P3 - Nice to Have
- [ ] Webhooks para receber dados de outros sistemas
- [ ] Relatórios avançados e exportação
- [ ] Notificações em tempo real

## Next Tasks
1. Popular base de dados com dados de teste para demonstração
2. Configurar integração SharePoint quando credenciais estiverem disponíveis
3. Adicionar validações de campos mais robustas
4. Implementar notificações de chamados pendentes

