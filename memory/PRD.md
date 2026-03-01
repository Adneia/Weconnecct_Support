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
7. **Reclame Aqui** (usa apenas primeiro nome do cliente)
8. Assistência Técnica

## Textos por Categoria

### Reclame Aqui
- Resposta Inicial (Prezado(a) Sr(a). [PRIMEIRO_NOME]...)
- Mensagem WhatsApp
- Solicitar Encerramento
- Após Avaliação

### Assistência Técnica
**SAC do Fornecedor:**
- Oderço, Ventisol, OEX, Hoopson

**SAC + Opção Reversa:**
- Ventisol + Reversa, OEX + Reversa

### Acompanhamento
**Status da Entrega:** Entregue (Possível Contestação/Contestação Expirada), Sem Comprovante
**Em Processo:** Total Express, J&T, ASAP, Correios (auto-detecção)
**Outros:** Cancelamento por Falta, Falha Integração, Ag. Compras, Problema NF

### Arrependimento
Reversa, Em Devolução, Devolvido, Bloqueio, Outros

## Bloco 3 - Anotações

### Dados da Reversa
- Número da Reversa
- Data de Vencimento (+10 dias auto)

### Motivo da Pendência (com textos padrão)
- Ag. Compras
- Ag. Logística
- Enviado
- Ag. Bseller
- Ag. Barrar
- Aguardando
- **Em devolução** → Ag. Devolução, Liberar Estorno, Confirmar Reenvio
- **Ag. Confirmação de Entrega** → Solicitar Confirmação, Extravio, Reenvio, Confirmado
- **Ag. Parceiro** → Estorno, Confirmação Encerramento, Encerramento

## Detalhes do Produto
- SKU, ID, Cód. Fornecedor, Marca, Quantidade, Valor

## Integrações
- **Google Sheets:** Atendimentos sincronizados ✅
- **Base de Dados:** ~152.000 pedidos ✅

## Credenciais de Teste
- Email: test@example.com
- Senha: password123

## Arquitetura
```
/app/
├── backend/server.py
├── frontend/src/pages/NovoChamado.js
└── memory/PRD.md
```

## Backlog
### P1 - Fluxo completo de Devoluções
### P2 - Interface conversacional, APIs de Rastreio
### P3 - Relatórios, Outlook/Zendesk, IA
