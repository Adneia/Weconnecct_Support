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
- Importação manual de dados do ERP via CSV/Excel (Tabelão)
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
- ✅ Import de Pedidos ERP via CSV/Excel (Tabelão WeConnect)
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

### Tabelão WeConnect - Campos Importados
- numero_pedido (Ped. Cliente)
- pedido_externo (Ped. Externo)
- data_emissao (Dt. Emissao)
- nome_cliente (Nome)
- cpf_cliente (CPF)
- cep, cidade, uf (Localização)
- status_pedido (Nome.1 - ex: "Entregue ao Cliente")
- data_status (Dt.Ult.Ponto de Controle)
- transportadora (Nome.3)
- produto (Nome.4)
- nota_fiscal (Nota)
- chave_nota (Chave Acesso)
- canal_vendas (Nome Canal de vendas)
- codigo_rastreio (Etiqueta)

### Database Collections
- users - Usuários do sistema
- chamados - Chamados de atendimento
- pedidos_erp - Dados importados do ERP (2326 pedidos)
- reversas - Processos de devolução
- historico - Log de ações por chamado

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Sistema de autenticação
- [x] CRUD de chamados
- [x] Dashboard básico
- [x] Importação do Tabelão WeConnect

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

## Credenciais de Acesso
- Email: atendente@weconnect.com
- Senha: teste123

## Next Tasks
1. Configurar integração SharePoint quando credenciais estiverem disponíveis
2. Adicionar mais validações de campos
3. Implementar notificações de chamados pendentes
4. Criar dashboard de métricas por atendente
