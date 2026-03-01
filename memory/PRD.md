# Emergent - Sistema de Atendimentos WeConnect

## Funcionalidades Implementadas

### Auto-preenchimento baseado no Status do Pedido
| Status do Pedido | Categoria | Motivo Pendência |
|-----------------|-----------|------------------|
| Aguardando estoque | Falha de Compras | Ag. Compras |
| NF emitida, NF Aprovada, Entregue à transportadora | Falha Produção | Ag. Logística |
| Em trânsito, Saiu para entrega | Falha Transporte | Enviado |
| Entregue ao Cliente | (Aberto para seleção) | (Aberto para seleção) |

### Motivos de Pendência
- Ag. Compras
- Ag. Logística
- Enviado
- Ag. Bseller
- Ag. Barrar
- Aguardando
- Em devolução

### Detecção Automática de Transportadora
O sistema detecta a transportadora do pedido e destaca o botão correspondente:
- **Total Express** - Pedidos com transportadora "Total" ou "Tex"
- **J&T Express** - Pedidos com "J&T" ou "JT"  
- **ASAP Log** - Pedidos com "ASAP" ou "Logística e Soluções"

Quando detectado, o botão aparece com:
- Badge mostrando nome da transportadora
- Borda azul destacada
- Checkmark (✓) no botão

### Busca de Pedidos (4 opções)
1. CPF
2. Pedido (externo)
3. Nome
4. Entrega

### Dados do Produto
- ID (codigo_item_bseller)
- SKU (cód. terceiro)
- Cód. Fornecedor
- Marca, Qtde, Valor

### Nota Fiscal + Galpão
- NF e Galpão na mesma linha
- Série 1=SC, 2=ES, 6=SP

### Textos por Categoria

**Falha Produção:**
- Sem Rastreio
- Total Express (com link)
- J&T Express (com chave)
- ASAP Log (com NF)

**Avaria:**
- Necessário Evidência
- Transporte até R$250
- Reversa

**Formato:** Sempre "Olá, Boa tarde." + [ASSINATURA] = atendente

## Integração Google Sheets
- Service Account: `atendimento-bot-emergent@emergent-atendimento.iam.gserviceaccount.com`
- Atendimentos: `1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs`

## Credenciais de Teste
- Email: test@emergent.com
- Senha: test123
