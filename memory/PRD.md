# Emergent - Sistema de Atendimentos WeConnect

## Status: MVP Funcional ✅
**Última atualização:** 01/03/2026

## Categorias (8)
1. Falha Produção
2. Falha de Compras
3. Falha Transporte
4. Produto com Avaria
5. Arrependimento
6. Acompanhamento
7. **Reclame Aqui** (renomeado de "Reclamação")
8. Assistência Técnica

## Textos por Categoria

### Reclame Aqui (ATUALIZADO)
- **Resposta Inicial** - Sempre começa com "Prezado(a) Sr(a). [NOME]", termina com "Equipe de Atendimento Weconnect"
- **Mensagem WhatsApp** - Para contato via WhatsApp
- **Solicitar Encerramento** - Pedir encerramento da reclamação
- **Após Avaliação** - Agradecimento após avaliação

### Assistência Técnica (ATUALIZADO)
**SAC do Fornecedor:**
- Oderço (📞 44 2101-1428)
- Ventisol (https://assistencia.ventisol.com.br/)
- OEX (📞 0800 887 0505 / reversa@newex.com.br)
- Hoopson (📞 +55 21 3809-2001)

**SAC + Opção Reversa:**
- Ventisol + Reversa (inclui código de postagem)
- OEX + Reversa (inclui código de postagem)

### Acompanhamento
**Status da Entrega:**
- Entregue (Possível Contestação)
- Entregue (Contestação Expirada)
- Sem Comprovante de Entrega

**Em Processo de Entrega (por transportadora):**
- Total Express (auto-detecção)
- J&T Express
- ASAP Log
- Correios

**Outros:**
- Cancelamento por Falta
- Falha de Integração
- Ag. Compras
- Problema na Emissão da NF

### Arrependimento
**Reversa:**
- 1ª Reversa (10 dias)
- 2ª Reversa (7 dias - última tentativa)
- Irá Vencer
- Expirada

**Em Devolução / Devolvido / Bloqueio / Outros**

## Bloco 3 - Anotações (ATUALIZADO)
**Dados da Reversa:**
- Número da Reversa (campo de entrada)
- Data de Vencimento (+10 dias auto-preenchido)

**Outros:**
- Motivo da Pendência (dropdown)
- Status atual do pedido
- Campo de anotações

## Detalhes do Produto
- SKU
- ID
- **Cód. Fornecedor** ✅
- Marca
- Quantidade
- Valor

## Integrações
- **Google Sheets:** Atendimentos sincronizados automaticamente ✅
- **Base de Dados:** ~152.000 pedidos importados ✅

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
