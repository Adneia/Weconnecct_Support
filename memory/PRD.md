# ELO - Sistema de Controle de Chamados WeConnect

## Problema Original
Sistema de controle de chamados (tickets) para a equipe de atendimento da WeConnect. Gerencia atendimentos a clientes, integra com Google Sheets para devoluções, e suporta importação de dados via Excel.

## Arquitetura
- **Frontend:** React + TailwindCSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (motor) + Pydantic
- **Integrações:** Google Sheets (gspread), Importação Excel (pandas)

## Funcionalidades Implementadas

### Core (MVP)
- CRUD de chamados (criar, editar, listar, buscar)
- Autenticação JWT com níveis de acesso (admin/standard)
- Dashboard com gráficos e estatísticas
- Lista de chamados com filtros avançados
- Textos padrão por categoria
- Gestão de reversas
- Importação de pedidos ERP via Excel (.xlsx)
- Exportação Excel de relatórios
- Integração Google Sheets para devoluções

### Sessão Anterior (6 ajustes)
- Reabertura de chamados encerrados
- Lógica de textos padrão (Falha Fornecedor → Aguardando, Reversa com Assistência)
- Exportação Excel com data do último status
- Gestão de devoluções sem duplicatas
- Sinalização visual de reversas próximas ao vencimento
- Limpeza de categorias (Entrega → Entregue/Falha de Transporte)
- Refatoração do NovoChamado.js (4300 → 900 linhas)
- Correção do bug de importação de Excel

### Sessão Atual — 5 Ajustes Março 2026
- **AJUSTE 1:** Fluxo automático Motivo de Pendência baseado em mapeamento Status do Pedido → Motivo
- **AJUSTE 2:** Limpar "Verificar" ao mudar Motivo de Pendência
- **AJUSTE 3:** Filtro de Parceiro/Canal com seleção múltipla (checkboxes)
- **AJUSTE 4:** Card "Total na Base" independente de filtros (substitui card antigo)
- **AJUSTE 5:** Exibir data do status (Dt.Ult.Ponto de Controle) na coluna STATUS PEDIDO

### Sessão Atual — Correções de Produção (Mar 2026)
- **Correção de Importação Excel (.0):** Botão "Corrigir Números" na tela Base ELO
- **Sistema de Backup/Restauração:** Botão "Selecionar Backup" para importar Excel de backup
- **Otimização Sync Google Sheets:** Reescrita para operações em lote (batch_update)
- **Prevenção de Duplicatas:** Validação HTTP 409 no backend
- **Funcionalidade de Exclusão:** Botão Excluir no formulário + notificação admin
- **Correção de Motivos Inconsistentes:** Botão "Corrigir Motivos" que verifica e corrige motivo_pendencia conforme mapeamento Status→Motivo
- **Correção de Status Inconsistentes:** Validação para impedir encerramento com motivos não-finalizadores
- **Google Sheets — ID_Atendimento:** Adicionada coluna B com ID do atendimento (A=Data, B=ID). Sync-all popula IDs existentes.
- **Card — Botões de Copiar:** Nome, CPF, e-mail, telefone, produto, valor e CEP (8 dígitos com zero à esquerda) são copiáveis ao clicar
- **E-mail Padrão:** Quando não há e-mail cadastrado, exibe atendimento@weconnect360.com.br
- **Notificação Início Atendimentos:** Primeiro chamado do dia de cada atendente gera notificação para Adnéia
- **Limpar Filtro:** Reseta todos os filtros (incluindo searchType e localStorage)

## Backlog / Próximas Tarefas
- P0: Deploy em produção e execução dos scripts de correção
- P1: Análise dos requisitos restantes do Prompt_Completo_ELO_Marco2026.md
- P2: Interface conversacional (chatbot)
- P2: Integração com APIs de Rastreio (Correios / Total Express)
- P3: Geração de Relatórios nativa
- P3: Integração com Canais de Entrada (Outlook, Zendesk)
- P3: Integração com IA para sugestão de categorias e resumos
- P3: Mover botões de admin para Painel de Administração dedicado

## Credenciais de Teste
- Admin: adneia@weconnect360.com.br / 20wead
- Standard: leticia@weconnect360.com.br / Teste123
