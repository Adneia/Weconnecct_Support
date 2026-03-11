# Atualização Completa do ELO — Março 2026

Emergent, execute todos os ajustes abaixo em sequência e reporte o resultado de cada um no final.

---

## AJUSTE 1 — Fluxo automático de Motivo de Pendência

### Regra de mapeamento

Sempre que consultar ou atualizar o Status do Pedido de um atendimento, aplique automaticamente o Motivo de Pendência conforme a tabela abaixo:

| Status do Pedido (Tabelão)             | Motivo de Pendência  |
|----------------------------------------|----------------------|
| Aguardando estoque                     | Ag. Compras          |
| Pedido aprovado                        | Ag. Compras          |
| Aguardando aprovação de pagamento      | Ag. Compras          |
| Aguardando liberacao do SAC            | Ag. Compras          |
| NF emitida                             | Ag. Logística        |
| Entregue a Transportadora              | Ag. Logística        |
| COLETA REALIZADA                       | Ag. Logística        |
| CARGA REDESPACHADA                     | Ag. Logística        |
| PROCESSAMENTO NA FILAL                 | Enviado              |
| EM TRANSFERENCIA                       | Enviado              |
| ENTRADA FILIAL                         | Enviado              |
| SAIDA FILIAL                           | Enviado              |
| EM TRÂNSITO                            | Enviado              |
| EM ROTA DE ENTREGA                     | Enviado              |
| SAIU PARA ENTREGA                      | Enviado              |
| FECHADO                                | Enviado              |
| AGUARDANDO RETIRADA                    | Enviado              |
| Recebimento de Insucesso de Entrega    | Ag. Parceiro         |
| DESTINATÁRIO AUSENTE                   | Ag. Parceiro         |
| ENDEREÇO NÃO LOCALIZADO                | Ag. Parceiro         |
| ENDEREÇO INSUFICIENTE                  | Ag. Parceiro         |
| DESTINATÁRIO NÃO LOCALIZADO            | Ag. Parceiro         |
| DESTINATÁRIO MUDOU-SE                  | Ag. Parceiro         |
| DESTINATÁRIO DESCONHECIDO              | Ag. Parceiro         |
| NÃO VISITADO                           | Ag. Parceiro         |
| ÁREA NÃO ATENDIDA                      | Ag. Parceiro         |
| CARGA RECUSADA PELO DESTINATARIO       | Ag. Parceiro         |
| AVERIGUAR FALHA NA ENTREGA             | Ag. Parceiro         |
| PROBLEMA OPERACIONAL                   | Ag. Parceiro         |
| FATORES NATURAIS                       | Ag. Parceiro         |
| EXTRAVIO                               | Ag. Cliente          |
| ROUBO                                  | Ag. Cliente          |
| AVARIA                                 | Ag. Cliente          |
| EM DEVOLUÇÃO                           | Em Devolução         |
| DEVOLUCAO                              | Em Devolução         |
| Entrega cancelada                      | ⚠️ Não alterar — aguarda ação manual do atendente |
| CANCELADO                              | ⚠️ Não alterar — aguarda ação manual do atendente |
| Entregue ao Cliente                    | Entregue             |
| ENTREGUE                               | Entregue             |

### Regras de execução

- **Só atualizar automaticamente** se o Motivo de Pendência atual for `Ag. Compras`, `Ag. Logística` ou `Enviado`
- **Nunca tocar** em registros cujo Motivo de Pendência seja qualquer outro valor — esses exigem ação manual do atendente
- **Não alterar** registros com Status do Pedido `Entrega cancelada` ou `CANCELADO` — apenas sinalize

### Aplicar agora

Percorra todos os atendimentos com **Status = Pendente** e aplique o mapeamento acima respeitando as regras.

### Regra permanente

- Ao registrar novo atendimento → preencher Motivo de Pendência automaticamente com base no Status do Pedido
- Ao atualizar atendimento existente → só atualizar se o Motivo atual for `Ag. Compras`, `Ag. Logística` ou `Enviado`
- Todos os demais motivos → nunca sobrescrever automaticamente

---

## AJUSTE 2 — Limpar "Verificar" ao mudar Motivo de Pendência

### Regra

Sempre que o campo **Motivo de Pendência** for alterado — por ação manual ou atualização automática — limpar automaticamente o campo **Verificar**.

- Motivo de Pendência mudou → `Verificar` = vazio
- Motivo de Pendência não mudou → `Verificar` permanece como está

### Aplicar agora

Percorra todos os atendimentos com **Verificar preenchido** e limpe o campo nos registros onde o Motivo de Pendência foi alterado desde que o `Verificar` foi marcado.

### Regra permanente

Implementar como regra fixa: toda vez que o Motivo de Pendência mudar, o campo Verificar é limpo automaticamente.

---

## AJUSTE 3 — Filtro de Parceiro/Canal com seleção múltipla

Hoje o filtro **Parceiro/Canal** permite selecionar apenas um canal por vez.

**O que mudar:**
- Transformar em seleção múltipla — o atendente deve poder marcar dois ou mais canais simultaneamente (ex: CSU + LTM + Livelo)
- A lista de opções permanece a mesma (Bradesco, CSU, Camicado, Coopera, Global Rewards, LL Loyalty, LTM, Livelo, Mercado Livre, NiceQuest, Senff, ShopHub, Sicredi, Tudo Azul)
- Quando mais de um canal estiver selecionado, exibir no campo: `3 canais selecionados` (ou o número correspondente)
- A opção **Todos Parceiros** desmarca todos e volta ao estado padrão

---

## AJUSTE 4 — Card de Total Geral da Base

No canto superior direito dos cards de resumo existe um card destacado em amarelo que atualmente mostra **"Aberto p/ [data]"**.

**O que mudar:**
- Substituir o conteúdo por: total geral de todos os registros no Google Sheets — independente de filtros aplicados na tela
- Label do card: `Total na Base`
- Manter o destaque visual atual (fundo/borda amarela)

---

## AJUSTE 5 — Exibir data do status na coluna STATUS PEDIDO

Hoje a coluna **STATUS PEDIDO** exibe apenas o texto do status.

**O que mudar:**
- Abaixo do texto do status, exibir a data do campo `Dt.Ult.Ponto de Controle` do último arquivo do Tabelão importado
- Formato visual:
  ```
  Entregue a Transportadora
  23/02/2026             ← cinza, fonte pequena
  ```
- Se a data não estiver disponível, exibir apenas o status normalmente

---

## Relatório final

```
✅ ATUALIZAÇÃO COMPLETA — ELO

AJUSTE 1 — Fluxo Motivo de Pendência
  Pendentes verificados:                    [X]
  Elegíveis (Ag. Compras/Logística/Enviado):[X]
  Atualizados:                              [X]
  Ignorados (outros motivos):               [X]
  Aguardando ação manual (cancelados):      [X]
  Distribuição final:
    Ag. Compras:    [X]
    Ag. Logística:  [X]
    Enviado:        [X]
    Ag. Parceiro:   [X]
    Ag. Cliente:    [X]
    Em Devolução:   [X]
    Entregue:       [X]

AJUSTE 2 — Verificar limpo ao mudar Motivo
  Registros revisados:                      [X]
  Verificar limpo:                          [X]
  Verificar mantido:                        [X]

AJUSTE 3 — Filtro multiplo Parceiro/Canal:  OK
AJUSTE 4 — Card Total na Base:              OK  |  Total atual: [X] registros
AJUSTE 5 — Data na coluna Status Pedido:    OK
  Registros com data disponível:            [X]
  Registros sem data:                       [X]

💾 Todos os ajustes salvos no Google Sheets.
```
