# ELO - Sistema de Controle de Chamados WeConnect

## Problema Original
Sistema de controle de chamados (tickets) para a equipe de atendimento da WeConnect. Gerencia fluxos de trabalho, base de pedidos e automatiza mudanças de status.

## Arquitetura
- **Frontend:** React + TailwindCSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (motor) + Pydantic
- **Integração:** Google Sheets (gspread) para sincronização de atendimentos

## O que foi implementado

### Backend (COMPLETO)
- Arquitetura modular com APIRouter (routes/, models/, utils/, data/)
- CRUD completo de chamados com sincronização Google Sheets
- Upload/importação de pedidos ERP com polling de progresso
- Dashboard com estatísticas avançadas
- Gestão de textos padrão com log
- Endpoints de busca: Entrega, CPF, Nome, Pedido, Galpão+Nota
- Endpoint reabrir atendimento

### Frontend - Refatoração NovoChamado.js (COMPLETO - 10/03/2026)
- NovoChamado.js: 4288 → 901 linhas (-79%)
- TextosCategoriaButtons, SecaoAnotacoes, AcoesFormulario como componentes
- textos.js, textReplacer.js, constants.js como utilidades

### Ajustes implementados (11/03/2026)
1. **Reabrir Atendimentos** - Botão "Reabrir" no formulário de edição + endpoint PUT /api/chamados/{id}/reabrir
2. **Falha Fornecedor reorganizada** - Textos removidos da categoria, adicionados ao motivo "Aguardando" com:
   - 1ª Reversa, 2ª Reversa (via API textos-padroes)
   - Reversa com Assistência Técnica (Ventisol, OEX, Oderço, Hoopson) - textos locais
   - Auto-detecção de fornecedor do pedido com highlight no botão correto
3. **Data Último Ponto no Excel** - Coluna adicionada na exportação
4. **Devoluções sem duplicar** - google_sheets.py verifica se já existe por numero_pedido e atualiza ao invés de inserir
5. **Reversas próximas de vencer** - Badge na coluna Reversa da ListaChamados mostrando "Vence em Xd" ou "Vencida"
6. **Categoria Comprovante de Entrega eliminada** - Textos movidos para motivo "Entregue" (comprovante API + Falha Transporte inline)

### Bug fix de importação (11/03/2026)
- Rota import-status movida antes de {numero_pedido} (conflito de rotas)
- Backend retorna import_id + total_rows para polling funcionar
- Frontend sempre usa polling quando status=processing (não mostra mais "concluída" prematuramente)
- Limite de upload aumentado de 10MB para 100MB
- Otimização: pré-cálculo de linhas usa openpyxl read_only ao invés de pandas

## Backlog Priorizado

### P1 - Próximas
- Implementar fluxo completo de Devoluções (Reversas)

### P2
- Interface conversacional (chatbot)
- Integração com APIs de Rastreio (Correios / Total Express)

### P3
- Geração de Relatórios nativa
- Integração com Canais de Entrada (Outlook, Zendesk)
- Integração com IA para sugestão de categorias e resumos
