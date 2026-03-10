# ELO - Sistema de Controle de Chamados WeConnect

## Problema Original
Sistema de controle de chamados (tickets) para a equipe de atendimento da WeConnect. Gerencia fluxos de trabalho, base de pedidos e automatiza mudanças de status.

## Arquitetura
- **Frontend:** React + TailwindCSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (motor) + Pydantic
- **Integração:** Google Sheets (gspread) para sincronização de atendimentos

## Telas e Funcionalidades
- Dashboard com estatísticas
- Novo Chamado (formulário completo com busca de pedidos, auto-preenchimento, textos padrão)
- Lista de Chamados (filtros avançados, exportação)
- Importar Pedidos (upload Excel/CSV)
- Gestão de Textos Padrão (CRUD com log de alterações)

## Autenticação
- JWT (email/senha)
- Admin: adneia@weconnect360.com.br
- Standard: leticia@weconnect360.com.br

## O que foi implementado

### Backend (COMPLETO)
- Arquitetura modular com APIRouter (routes/, models/, utils/, data/)
- CRUD completo de chamados com sincronização Google Sheets
- Upload/importação de pedidos ERP
- Dashboard com estatísticas avançadas
- Gestão de textos padrão com log
- Endpoints de busca: Entrega, CPF, Nome, Pedido, Galpão+Nota

### Frontend - Refatoração do NovoChamado.js (COMPLETO - 10/03/2026)
- **NovoChamado.js**: Reduzido de 4288 para 901 linhas (-79%)
- **TextosCategoriaButtons.js**: Botões de texto por categoria (304 linhas)
- **SecaoAnotacoes.js**: Seção de anotações com motivo, reversa, checkboxes (299 linhas)
- **AcoesFormulario.js**: Botões de ação (Criar, Encerrar, Cancelar) (88 linhas)
- **textos.js**: Todos os textos template extraídos (1025 linhas)
- **textReplacer.js**: Utilitário unificado para substituição de placeholders (89 linhas)
- **constants.js**: Constantes compartilhadas atualizadas

### Testado e validado
- Testing agent: 100% de sucesso em todos os fluxos
- Busca, classificação, textos por categoria, anotações, ações
- Edição de chamados existentes
- Dashboard e lista de chamados

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
