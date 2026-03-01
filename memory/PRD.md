# Emergent - Sistema de Atendimentos WeConnect

## Status: MVP Funcional ✅
**Última atualização:** 01/03/2026

## Categorias (8)
1. Falha Produção
2. Falha de Compras
3. Falha Transporte
4. Produto com Avaria
5. Arrependimento
6. **Acompanhamento** (substituiu "Dúvida")
7. Reclamação
8. Assistência Técnica

*(Divergência de Produto removida - usar Falha Produção ou Transporte)*

## Textos por Categoria

### Acompanhamento (NOVO - substituiu Dúvida)
**Status da Entrega:**
- Entregue (Possível Contestação)
- Entregue (Contestação Expirada)
- Sem Comprovante de Entrega

**Em Processo de Entrega (por transportadora):**
- Total Express (com auto-detecção)
- J&T Express
- ASAP Log
- Correios

**Outros:**
- Cancelamento por Falta
- Falha de Integração
- Ag. Compras
- Problema na Emissão da NF

### Arrependimento
**Dados da Reversa (NOVO):**
- Número da Reversa (campo de entrada)
- Data de Vencimento (+10 dias auto-preenchido)

**Reversa:**
- 1ª Reversa (10 dias)
- 2ª Reversa (7 dias - última tentativa)
- Irá Vencer
- Expirada

**Em Devolução:**
- Sem Estorno
- Com Estorno

**Devolvido:**
- Com Estorno
- Com Reenvio

**Bloqueio/Barragem:**
- Bloqueio OK
- Sem Bloqueio (em rota)
- Em Separação

**Outros:**
- Sem Coleta (impossibilidade)
- Prazo Expirado

### Falha Transporte
**Enviar Rastreio:**
- Total Express, J&T Express, ASAP Log, Correios

**Bloqueio:**
- Bloqueio OK, Não é Possível

**Extravio:**
- Simples, Com Previsão, Com Cancelamento

**Comprovante:**
- Falta Comprovante
- Desconhece (No Prazo/Fora Prazo)
- CSU - Email

### Falha Produção
- Sem Rastreio
- Com Rastreio (Total/J&T/ASAP)

### Produto com Avaria
- Necessário Evidência
- Transporte até R$250
- Reversa

## Detalhes do Produto
- SKU
- ID
- **Cód. Fornecedor** (NOVO - corrigido na importação)
- Marca
- Quantidade
- Valor

## Bloco 3 - Anotações
- Motivo da Pendência (dropdown)
- Status atual do pedido
- Campo de anotações

## Integrações
- **Google Sheets:** Atendimentos sincronizados automaticamente ✅
- **Base de Dados:** ~5000 pedidos importados ✅

## Credenciais de Teste
- Email: test@example.com
- Senha: password123

## Google Sheets
- Atendimentos: `1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs`

## Arquitetura
```
/app/
├── backend/
│   ├── server.py        # API FastAPI
│   ├── google_sheets.py # Integração Google Sheets
│   └── requirements.txt
├── frontend/
│   ├── src/pages/NovoChamado.js # Tela principal de criação
│   └── src/pages/Dashboard.js
└── memory/PRD.md
```

## Backlog
### P1 (Próximo)
- Fluxo completo de Devoluções (Reversas) - gerenciar ciclo de vida

### P2
- Interface conversacional (estilo chatbot)
- Integração com APIs de Rastreio (Correios, Total Express)

### P3
- Relatórios nativos
- Integração com Outlook/Zendesk
- IA para sugestões de categorias
