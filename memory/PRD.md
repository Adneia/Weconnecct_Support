# ELO - Sistema de Atendimentos WeConnect

## Status: MVP Funcional + Refatoração em Andamento ✅
**Última atualização:** 10/03/2026

## Changelog Recente
- ✅ **10/03/2026:** Melhorias de UX na Lista de Atendimentos (v2)
  - **Cópia de dados individual:** Cada célula da tabela é copiável ao clicar
    - Hover destaca a célula em azul claro
    - Toast de confirmação "X copiado!"
    - **SEM ícones de clipboard** - visualização limpa
    - **Solicitação também é copiável** (não mais link)
  - **Nova coluna de ação:** Ícone "abrir" (ExternalLink) na primeira coluna
    - Click normal: navega pela SPA
    - Ctrl+Click ou botão direito: abre em nova aba
  - **Persistência de filtros:** Filtros são salvos no localStorage
    - Ao voltar de um atendimento, filtros são mantidos
    - Busca e filtros avançados são restaurados automaticamente
  - **Notificação de importação:** Admin recebe notificação quando importação concluída
  - **Correção de chamados sem pedido ERP:** Atendimentos abrem corretamente
  - Arquivos modificados:
    - `/app/frontend/src/pages/ListaChamados.js`: Células copiáveis, coluna de ação, persistência de filtros
    - `/app/backend/server.py`: Notificação de importação
    - `/app/frontend/src/pages/NovoChamado.js`: Correção para isEditMode sem pedidoErp

- ✅ **09/03/2026:** Refatoração do Backend (Fase 1)
  - **Estrutura modular criada:**
    - `/app/backend/routes/chamados.py` - CRUD de atendimentos
    - `/app/backend/routes/pedidos.py` - Busca e importação de pedidos ERP
    - `/app/backend/routes/relatorios.py` - Relatórios Ag. Compras e Ag. Logística
    - `/app/backend/routes/textos.py` - Gestão de textos padrão
    - `/app/backend/routes/dashboard.py` - Estatísticas e métricas
    - `/app/backend/routes/devolucoes.py` - Registro de devoluções
  - **Componentes frontend criados:**
    - `/app/frontend/src/components/atendimento/constants.js` - Constantes e textos
    - `/app/frontend/src/components/atendimento/CardPedido.js` - Card do pedido ERP
    - `/app/frontend/src/components/atendimento/BuscaPedido.js` - Busca de pedidos
    - `/app/frontend/src/components/atendimento/DialogsAtendimento.js` - Diálogos modais
  - **Utils atualizados:**
    - `/app/backend/utils/helpers.py` - Adicionada função parse_date_safe

- ✅ **08/03/2026:** Corrigido fluxo completo de Devoluções
  - **Fluxo implementado:**
    1. Ao mudar motivo para "Em devolução" ou "Devolvido" → Diálogo pergunta "Deseja registrar na planilha?"
    2. Se "Sim" → Segundo diálogo pergunta status: Aguardando/Estornado/Reenviado
    3. Ao selecionar → Registra na planilha "Gestão Devoluções 2026_E" com:
       - Coluna J (Atendimento): Status selecionado
       - Coluna K (Devolvido por): "Correios" se tem reversa, senão nome da transportadora
       - Coluna L (Status_Galpao): "AGUARDANDO"
  - Arquivos modificados:
    - `/app/frontend/src/pages/NovoChamado.js`: handleMotivoPendenciaChange, handleDevolucaoConfirm, handleConfirmStatusDevolucao
    - `/app/backend/server.py`: DevolucaoCreate model, create_devolucao endpoint
    - `/app/backend/google_sheets.py`: add_devolucao_row com mapeamento de colunas J, K, L

- ✅ **06/03/2026:** Adicionada integração com dados de estoque (SIGEQ425)
- ✅ **03/03/2026:** Tabela "Atendimentos por Canal" expandida de 5 para 10 dias úteis
- ✅ Dashboard multi-abas completamente funcional com 7 abas
- ✅ Sincronização Google Sheets com formatação de fundo verde para encerrados

## Dashboard Multi-Abas (Implementado)

### Aba 1 - Visão Geral
- Cards: Total, Pendentes, Resolvidos, Tempo Médio, Mais Antigo, Base Emergent
- Gráfico: Atendimentos por Mês (últimos 6 meses)
- Gráfico: Abertos vs Resolvidos (barras por dia)

### Aba 2 - Volume por Canal
- Ranking por Canal com percentuais
- Gráfico de pizza: Distribuição por Canal

### Aba 3 - Classificação
- Por Categoria, Pendentes, Motivo da Pendência
- Top 10 Produtos, Por Fornecedor

### Aba 4 - Performance
- Tempo Médio por Canal e por Fornecedor

### Aba 5 - Pendências
- Detalhamento de pendências clicáveis

### Aba 6 - Estornos
- % Estornos por Mês e por Canal

### Aba 7 - Reincidência
- Métricas de reincidência

## Funcionalidades Principais

### Chamados/Atendimentos
- CRUD completo de atendimentos
- Busca por Entrega, CPF, Nome, Pedido, Galpão+Nota
- Categorias: Falha Produção, Compras, Transporte, etc.
- Motivos de Pendência com textos padrão
- Encerrar ao criar (checkbox)
- Verificar Adnéia / Retornar Chamado (flags)

### Devoluções (CORRIGIDO 08/03/2026)
- Fluxo de 3 passos: Registrar → Selecionar Status → Sincronizar
- Status: Aguardando, Estornado, Reenviado
- Devolvido por: Correios (se tem reversa) ou Transportadora
- Sincronização com planilha "Gestão Devoluções 2026_E"

### Relatórios
- Ag. Compras: SKU, Parceiro, Cidade, UF, Estoque
- Ag. Logística: Com status crítico
- Exportação Excel

### Textos Padrão
- Gestão de textos por categoria
- Acesso para todos os usuários
- Log de alterações (visível para admin)

### Integrações
- Google Sheets (gspread): 2 planilhas
  - Atendimentos 2026_E
  - Gestão Devoluções 2026_E

## Arquitetura

```
/app/
├── backend/
│   ├── server.py              # API FastAPI (ainda monolítico - migração em andamento)
│   ├── main_modular.py        # NOVO: Entry point para rotas modulares
│   ├── google_sheets.py       # Integração Google Sheets
│   ├── credentials.json       # Service Account
│   ├── routes/                # NOVO: Rotas modulares
│   │   ├── __init__.py
│   │   ├── auth.py            # Autenticação JWT
│   │   ├── chamados.py        # CRUD de atendimentos
│   │   ├── pedidos.py         # Busca e importação ERP
│   │   ├── relatorios.py      # Relatórios
│   │   ├── textos.py          # Textos padrão
│   │   ├── dashboard.py       # Dashboard stats
│   │   └── devolucoes.py      # Devoluções
│   ├── models/                # Modelos Pydantic
│   │   ├── chamado.py
│   │   ├── pedido.py
│   │   └── user.py
│   └── utils/
│       ├── auth.py            # JWT helpers
│       ├── database.py        # MongoDB connection
│       └── helpers.py         # Funções utilitárias
└── frontend/
    └── src/
        ├── pages/
        │   ├── NovoChamado.js    # Formulário de atendimento (em refatoração)
        │   ├── ListaChamados.js  # Lista e filtros
        │   └── Dashboard.js      # Dashboard multi-abas
        └── components/
            ├── ui/              # Shadcn/UI
            └── atendimento/     # NOVO: Componentes de atendimento
                ├── index.js
                ├── constants.js
                ├── CardPedido.js
                ├── BuscaPedido.js
                └── DialogsAtendimento.js
```

## Credenciais de Teste
- Admin: adneia@weconnect360.com.br / 20wead
- Standard: leticia@weconnect360.com.br / Teste123

## Próximas Tarefas (P0-P3)

### P0 - Crítico
- [x] Refatoração do backend - Rotas modulares criadas (Fase 1 completa)
- [x] Refatoração do frontend - Componentes de atendimento criados (Fase 1 completa)
- [ ] **Fase 2:** Migrar server.py para usar rotas modulares
- [ ] **Fase 2:** Integrar componentes no NovoChamado.js

### P1 - Alta Prioridade
- [x] Carga da base de atendimentos históricos (1351 registros)
- [ ] Fluxo completo de Reversas

### P2 - Média Prioridade
- [ ] Interface conversacional (chatbot)
- [ ] Integração com APIs de Rastreio (Correios, Total Express)

### P3 - Baixa Prioridade
- [ ] Geração de Relatórios nativa
- [ ] Integração Outlook/Zendesk
- [ ] IA para sugestão de categorias
