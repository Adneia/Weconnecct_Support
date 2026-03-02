# Emergent - Sistema de Atendimentos WeConnect

## Status: MVP Funcional ✅
**Última atualização:** 02/03/2026

## Changelog Recente
- ✅ Corrigido crash na página Novo Chamado (estado verificarAdneia já existia)
- ✅ Reimportados 152.551 pedidos para base de dados
- ✅ Adicionado campo `verificar_adneia` nos modelos Pydantic
- ✅ Adicionado card "Adnéia" na Lista de Atendimentos (roxo)
- ✅ Adicionado badge "Adnéia" na tabela de atendimentos
- ✅ Adicionado filtro `verificar_adneia` no endpoint GET /api/chamados
- ✅ Texto "(precisa atuação)" removido do checkbox "Retornar Chamado"

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

## Fluxo de Trabalho
- **Retornar Chamado:** Checkbox amarelo para sinalizar que o chamado precisa de retorno
- **Verificar Adnéia:** Checkbox roxo para sinalizar que Adnéia precisa verificar

## Integrações
- **Google Sheets:** Atendimentos sincronizados ✅
- **Base de Dados:** 152.551 pedidos importados ✅

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
