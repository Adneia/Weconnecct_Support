# Mapeamento: Status do Pedido (Tabelão) → Motivo de Pendência
# Conforme Prompt_Completo_ELO_Marco2026.md

STATUS_PEDIDO_TO_MOTIVO = {
    # Ag. Compras
    "Aguardando estoque": "Ag. Compras",
    "Pedido aprovado": "Ag. Compras",
    "Aguardando aprovação de pagamento": "Ag. Compras",
    "Aguardando liberacao do SAC": "Ag. Compras",
    # Ag. Logística
    "NF emitida": "Ag. Logística",
    "Entregue a Transportadora": "Ag. Logística",
    "COLETA REALIZADA": "Ag. Logística",
    "CARGA REDESPACHADA": "Ag. Logística",
    # Enviado
    "PROCESSAMENTO NA FILAL": "Enviado",
    "EM TRANSFERENCIA": "Enviado",
    "ENTRADA FILIAL": "Enviado",
    "SAIDA FILIAL": "Enviado",
    "EM TRÂNSITO": "Enviado",
    "EM ROTA DE ENTREGA": "Enviado",
    "SAIU PARA ENTREGA": "Enviado",
    "FECHADO": "Enviado",
    "AGUARDANDO RETIRADA": "Enviado",
    # Ag. Parceiro
    "Recebimento de Insucesso de Entrega": "Ag. Parceiro",
    "DESTINATÁRIO AUSENTE": "Ag. Parceiro",
    "ENDEREÇO NÃO LOCALIZADO": "Ag. Parceiro",
    "ENDEREÇO INSUFICIENTE": "Ag. Parceiro",
    "DESTINATÁRIO NÃO LOCALIZADO": "Ag. Parceiro",
    "DESTINATÁRIO MUDOU-SE": "Ag. Parceiro",
    "DESTINATÁRIO DESCONHECIDO": "Ag. Parceiro",
    "NÃO VISITADO": "Ag. Parceiro",
    "ÁREA NÃO ATENDIDA": "Ag. Parceiro",
    "CARGA RECUSADA PELO DESTINATARIO": "Ag. Parceiro",
    "AVERIGUAR FALHA NA ENTREGA": "Ag. Parceiro",
    "PROBLEMA OPERACIONAL": "Ag. Parceiro",
    "FATORES NATURAIS": "Ag. Parceiro",
    # Ag. Cliente
    "EXTRAVIO": "Ag. Cliente",
    "ROUBO": "Ag. Cliente",
    "AVARIA": "Ag. Cliente",
    # Em Devolução
    "EM DEVOLUÇÃO": "Em Devolução",
    "DEVOLUCAO": "Em Devolução",
    # Entregue
    "Entregue ao Cliente": "Entregue",
    "ENTREGUE": "Entregue",
}

# Statuses que NÃO devem ser alterados automaticamente
STATUS_NAO_ALTERAR = ["Entrega cancelada", "CANCELADO"]

# Motivos que permitem atualização automática
MOTIVOS_AUTO_ATUALIZAVEIS = ["Ag. Compras", "Ag. Logística", "Enviado"]


def get_motivo_from_status(status_pedido: str) -> str | None:
    """Retorna o motivo de pendência baseado no status do pedido, ou None se não mapeado."""
    if not status_pedido:
        return None
    # Verificar se está na lista de não-alterar
    if status_pedido in STATUS_NAO_ALTERAR:
        return None
    # Busca exata
    if status_pedido in STATUS_PEDIDO_TO_MOTIVO:
        return STATUS_PEDIDO_TO_MOTIVO[status_pedido]
    # Busca case-insensitive
    status_lower = status_pedido.strip().lower()
    for key, value in STATUS_PEDIDO_TO_MOTIVO.items():
        if key.lower() == status_lower:
            return value
    return None
