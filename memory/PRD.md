# Emergent - Sistema de Atendimentos WeConnect

## Status: MVP Funcional + Dashboard Multi-Abas ✅
**Última atualização:** 02/03/2026

## Changelog Recente
- ✅ Corrigido bug do SelectItem com value="" no Dashboard (erro de runtime)
- ✅ Dashboard multi-abas completamente funcional com 7 abas
- ✅ Backend com endpoints /api/dashboard/v2/* implementados
- ✅ Filtros globais (Período, Canal, Fornecedor) funcionando
- ✅ Gráficos com recharts (LineChart, BarChart, PieChart)

## Dashboard Multi-Abas (Implementado)

### Aba 1 - Visão Geral
- Cards: Total, Pendentes, Resolvidos, Tempo Médio, Mais Antigo, Base Emergent
- Gráfico: Atendimentos por Mês (últimos 6 meses)
- Gráfico: Abertos vs Resolvidos (barras por dia)

### Aba 2 - Volume por Canal
- Ranking por Canal com percentuais
- Gráfico de pizza: Distribuição por Canal

### Aba 3 - Classificação
- Por Categoria
- Pendentes por Categoria
- Por Motivo da Pendência
- Top 10 Produtos
- Por Fornecedor

### Aba 4 - Performance
- Tempo Médio por Canal (gráfico de barras horizontal)
- Tempo Médio por Fornecedor (gráfico de barras horizontal)

### Aba 5 - Pendências
- Card: Total Pendentes
- Listas: Por Categoria, Por Motivo, Por Canal
- Tabela: Detalhamento (lista de pendências clicáveis)

### Aba 6 - Estornos
- Cards: Total Estornos, % Geral
- Gráfico: % Estornos por Mês
- Ranking: % por Canal

### Aba 7 - Reincidência
- Cards: Taxa Geral, Clientes Reincidentes
- Lista: Reincidência por Canal
- Lista: Reincidência por Produto (Top 10)

### Filtros Globais
- Período: 7 dias, 30 dias, 90 dias, 1 ano
- Canal de Venda
- Fornecedor

## Categorias (8)
1. Falha Produção
2. Falha de Compras
3. Falha Transporte
4. Produto com Avaria
5. Arrependimento
6. Acompanhamento
7. Reclame Aqui
8. Assistência Técnica

## Fluxo de Trabalho
- **Retornar Chamado:** Checkbox amarelo para sinalizar retorno
- **Verificar:** Checkbox roxo para sinalizar verificação necessária

## Integrações
- **Google Sheets:** Atendimentos e Devoluções sincronizados ✅
- **Base de Dados:** 152.551 pedidos importados ✅

## Credenciais de Teste
- Email: test@example.com
- Senha: password123

## Arquitetura
```
/app/
├── backend/
│   ├── server.py        # FastAPI com rotas, modelos e lógica
│   ├── google_sheets.py # Integração Google Sheets
│   └── requirements.txt
├── frontend/
│   ├── src/pages/
│   │   ├── Dashboard.js     # Dashboard multi-abas (7 abas)
│   │   ├── NovoChamado.js   # Criar/editar chamados
│   │   ├── ListaChamados.js # Lista com filtros
│   │   └── ImportarPedidos.js
│   └── package.json
└── memory/PRD.md
```

## Backlog

### P1 - Refatoração (RECOMENDADO)
- Dividir server.py em routes/, models/, services/
- Decompor NovoChamado.js em componentes menores

### P1 - Fluxo completo de Devoluções

### P2 - Interface conversacional, APIs de Rastreio

### P3 - Relatórios, Outlook/Zendesk, IA

## API Endpoints

### Autenticação
- POST /api/auth/register
- POST /api/auth/login

### Atendimentos
- GET /api/chamados (com filtros)
- POST /api/chamados
- PUT /api/chamados/{id}
- DELETE /api/chamados/{id}

### Dashboard V2
- GET /api/dashboard/v2/visao-geral
- GET /api/dashboard/v2/volume-canal
- GET /api/dashboard/v2/classificacao
- GET /api/dashboard/v2/performance
- GET /api/dashboard/v2/pendencias
- GET /api/dashboard/v2/estornos
- GET /api/dashboard/v2/reincidencia
- GET /api/dashboard/v2/filtros

### Pedidos
- GET /api/pedidos/search
- POST /api/pedidos/import

### Google Sheets
- GET /api/google-sheets/status
- POST /api/google-sheets/initialize
- POST /api/devolucoes
