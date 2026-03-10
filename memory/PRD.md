# ELO - Sistema de Controle de Chamados WeConnect

## Problema Original
Sistema de controle de chamados (tickets) para a equipe de atendimento da WeConnect. Gerencia fluxos de trabalho, base de pedidos ERP, e automatiza mudanças de status.

## Stack
- **Frontend:** React, TailwindCSS, Shadcn/UI, React Router, Axios, Sonner
- **Backend:** FastAPI, Pydantic, Motor (MongoDB async)
- **Database:** MongoDB
- **Integrações:** Google Sheets (gspread), JWT Auth

## Telas e Funcionalidades
- Dashboard com estatísticas e gráficos
- Novo Atendimento (formulário com busca de pedidos, auto-preenchimento, duplicatas)
- Lista de Atendimentos (filtros avançados, exportação Excel, cópia de células, persistência de filtros)
- Importar Pedidos (upload Excel/CSV com background processing)
- Gestão de Textos Padrão (CRUD com log de alterações)
- Base ELO (visualização de pedidos)

## Credenciais de Teste
- Admin: adneia@weconnect360.com.br / 20wead
- Standard: leticia@weconnect360.com.br / Teste123

## O Que Está Implementado
- Auth JWT completa
- CRUD de chamados com histórico
- Dashboard com múltiplas abas (Visão Geral, Volume, Classificação, Performance, Pendências, Estornos, Reincidência)
- Importação de pedidos ERP via Excel
- Sincronização individual com Google Sheets (Atendimentos + Devoluções)
- Textos padrão para atendimentos
- Filtros avançados com persistência (localStorage)
- Exportação de relatórios Excel customizados
- Notificação para admin após importação
- Cópia de dados de células individuais e botão "Copiar Reversas"
- Lógica de auto-limpeza de motivo_pendencia ao encerrar chamados (fix P0)
- Dados padronizados (ENtregue, Ag. logística, motivos compostos corrigidos)

## Tarefas Pendentes

### P1 - Em Progresso
- Refatoração Backend (Fase 2): migrar server.py monolítico para /backend/routes/
- Refatoração Frontend (Fase 2): quebrar NovoChamado.js em sub-componentes /components/atendimento/

### P1 - Próximas
- Implementar fluxo completo de Devoluções (Reversas)

### P2 - Futuras
- Interface conversacional (chatbot)
- Integração com APIs de Rastreio (Correios, Total Express)

### P3 - Backlog
- Geração de Relatórios nativa
- Integração com Canais de Entrada (Outlook, Zendesk)
- Integração com IA para sugestão de categorias e resumos

## Arquitetura Crítica
- `server.py` (4822 linhas): Arquivo monolítico que precisa ser dividido
- `NovoChamado.js` (4288 linhas): Componente monolítico que precisa ser dividido
- Arquivos de rotas modulares já existem em /backend/routes/ mas NÃO estão em uso
- Componentes modulares já existem em /frontend/src/components/atendimento/ mas NÃO estão em uso

## Notas Importantes
- Sincronização com Google Sheets é individual (na edição), não em massa
- Google Sheets credentials em /app/backend/credentials.json
- MOTIVOS_FINALIZADORES: Entregue, Estornado, Atendido, Em devolução, Devolvido, Encerrado
