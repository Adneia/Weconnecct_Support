# ELO - Sistema de Atendimentos WeConnect

## Status: MVP Funcional + Fluxo de Devoluções Corrigido ✅
**Última atualização:** 08/03/2026

## Changelog Recente
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
│   ├── server.py          # API FastAPI (monolítico)
│   ├── google_sheets.py   # Integração Google Sheets
│   └── credentials.json   # Service Account
└── frontend/
    └── src/
        ├── pages/
        │   ├── NovoChamado.js    # Formulário de atendimento
        │   ├── ListaChamados.js  # Lista e filtros
        │   └── Dashboard.js      # Dashboard multi-abas
        └── components/ui/        # Shadcn/UI
```

## Credenciais de Teste
- Admin: adneia@weconnect360.com.br / 20wead
- Standard: leticia@weconnect360.com.br / Teste123

## Próximas Tarefas (P0-P3)

### P0 - Crítico
- [ ] Refatoração do backend (server.py → estrutura modular)
- [ ] Refatoração do frontend (NovoChamado.js → componentes menores)

### P1 - Alta Prioridade
- [ ] Carga da base de atendimentos históricos (Excel)
- [ ] Fluxo completo de Reversas

### P2 - Média Prioridade
- [ ] Interface conversacional (chatbot)
- [ ] Integração com APIs de Rastreio (Correios, Total Express)

### P3 - Baixa Prioridade
- [ ] Geração de Relatórios nativa
- [ ] Integração Outlook/Zendesk
- [ ] IA para sugestão de categorias
