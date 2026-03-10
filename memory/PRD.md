# ELO - Sistema de Controle de Chamados WeConnect

## Problema Original
Sistema de controle de chamados (tickets) para a equipe de atendimento da WeConnect. Gerencia fluxos de trabalho, base de pedidos ERP, e automatiza mudanças de status.

## Stack
- **Frontend:** React, TailwindCSS, Shadcn/UI, React Router, Axios, Sonner
- **Backend:** FastAPI, Pydantic, Motor (MongoDB async)
- **Database:** MongoDB
- **Integrações:** Google Sheets (gspread), JWT Auth

## Arquitetura (Pós-Refatoração v2.0)
```
/app/backend/
├── server.py              # Entry point (~80 linhas)
├── server_legacy.py       # Backup do monolítico original
├── google_sheets.py       # Google Sheets client
├── models/
│   ├── user.py            # User, UserCreate, UserLogin, TokenResponse
│   ├── chamado.py         # Chamado, ChamadoCreate, ChamadoUpdate
│   ├── pedido.py          # PedidoERP, Reversa
│   ├── historico.py       # Historico, HistoricoCreate
│   ├── notificacao.py     # Notificacao
│   └── devolucao.py       # DevolucaoCreate
├── data/
│   └── textos_padroes.py  # TEXTOS_PADROES dict + constantes
├── utils/
│   ├── database.py        # MongoDB client + JWT config
│   ├── auth.py            # Auth helpers + get_current_user
│   └── helpers.py         # parse_date_safe, calcular_dias_uteis, etc.
└── routes/
    ├── auth.py            # /api/auth/* endpoints
    ├── chamados.py        # /api/chamados/* + historico + reversas
    ├── textos.py          # /api/textos-padroes/*
    ├── relatorios.py      # /api/relatorios/*
    ├── pedidos.py         # /api/pedidos-erp/* + estoque + fornecedores
    ├── dashboard.py       # /api/dashboard/* + V2
    ├── admin.py           # /api/admin/* (correções de dados)
    ├── notificacoes.py    # /api/notificacoes/* + verificar-canais
    ├── devolucoes.py      # /api/devolucoes/*
    └── google_sheets_routes.py  # /api/google-sheets/*
```

## Telas e Funcionalidades
- Dashboard com 7 abas (Visão Geral, Volume, Classificação, Performance, Pendências, Estornos, Reincidência)
- Novo Atendimento (formulário com busca de pedidos, auto-preenchimento, duplicatas)
- Lista de Atendimentos (filtros avançados, exportação Excel, cópia de células, persistência de filtros)
- Importar Pedidos (upload Excel/CSV com background processing + notificação admin)
- Gestão de Textos Padrão (CRUD com log de alterações)
- Base ELO (visualização de pedidos)

## Credenciais de Teste
- Admin: adneia@weconnect360.com.br / 20wead
- Standard: leticia@weconnect360.com.br / Teste123

## O Que Está Implementado
- Auth JWT completa
- CRUD de chamados com histórico
- Dashboard com múltiplas abas
- Importação de pedidos ERP via Excel
- Sincronização individual com Google Sheets
- Textos padrão para atendimentos
- Filtros avançados com persistência (localStorage)
- Exportação de relatórios Excel customizados
- Auto-limpeza de motivo_pendencia ao encerrar chamados
- Dados padronizados no banco
- **Backend refatorado** de 4827 para ~80 linhas (entry point) + módulos

## Tarefas Pendentes

### P1 - Em Progresso
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

## Notas Importantes
- Sincronização com Google Sheets é individual (na edição), não em massa
- Google Sheets credentials em /app/backend/credentials.json
- MOTIVOS_FINALIZADORES: Entregue, Estornado, Atendido, Em devolução, Devolvido, Encerrado
- Backup do monolítico original em /app/backend/server_legacy.py
