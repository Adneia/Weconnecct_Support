from datetime import datetime, timezone, timedelta
import pandas as pd


def parse_date_safe(date_value) -> datetime:
    """Parse date value to timezone-aware datetime"""
    if date_value is None:
        return datetime.now(timezone.utc)
    if isinstance(date_value, str):
        try:
            dt = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
        except Exception:
            try:
                dt = pd.to_datetime(date_value).to_pydatetime()
            except Exception:
                dt = datetime.now(timezone.utc)
    elif hasattr(date_value, 'to_pydatetime'):
        dt = date_value.to_pydatetime()
    elif isinstance(date_value, datetime):
        dt = date_value
    else:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def calcular_dias_uteis(data_inicio, data_fim=None):
    """Calcula a quantidade de dias uteis entre duas datas"""
    if data_fim is None:
        data_fim = datetime.now(timezone.utc)
    if isinstance(data_inicio, str):
        try:
            data_str = data_inicio.split()[0]
            data_inicio = datetime.strptime(data_str, '%d/%m/%Y')
            data_inicio = data_inicio.replace(tzinfo=timezone.utc)
        except Exception:
            return 0
    if data_inicio.tzinfo is None:
        data_inicio = data_inicio.replace(tzinfo=timezone.utc)
    if data_fim.tzinfo is None:
        data_fim = data_fim.replace(tzinfo=timezone.utc)
    dias_uteis = 0
    data_atual = data_inicio
    while data_atual < data_fim:
        if data_atual.weekday() < 5:
            dias_uteis += 1
        data_atual += timedelta(days=1)
    return dias_uteis


def is_status_maiusculo(status):
    """Verifica se o status esta todo em maiusculas (indicando tracking)"""
    if not status:
        return False
    clean_status = status.strip()
    return len(clean_status) >= 4 and clean_status.isupper()


def get_galpao_from_serie(serie_nf: str, chave_nota: str = None) -> dict:
    """Retorna informacoes do galpao baseado na serie da NF"""
    if not serie_nf and chave_nota and len(chave_nota) >= 25:
        try:
            serie_nf = str(int(chave_nota[22:25]))
        except (ValueError, IndexError):
            pass
    if not serie_nf:
        return {"galpao": "Não identificado", "uf_galpao": "-"}
    serie_str = str(serie_nf).strip()
    if serie_str == "1":
        return {"galpao": "Santa Catarina", "uf_galpao": "SC", "serie_nf": "1"}
    elif serie_str == "6":
        return {"galpao": "São Paulo", "uf_galpao": "SP", "serie_nf": "6"}
    elif serie_str == "2":
        return {"galpao": "Espírito Santo", "uf_galpao": "ES", "serie_nf": "2"}
    else:
        return {"galpao": f"Série {serie_str}", "uf_galpao": "-", "serie_nf": serie_str}


def serialize_datetime(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


def serialize_doc(doc):
    for key, value in doc.items():
        doc[key] = serialize_datetime(value)
    return doc


def generate_reversa_code(numero_pedido: str):
    """Gera codigo de reversa no formato REV-XXXXXXXX-XXX"""
    import random
    suffix = str(random.randint(100, 999))
    return f"REV-{numero_pedido[-8:]}-{suffix}"


def normalize_transportadora(transportadora: str) -> str:
    """Normaliza o nome da transportadora para um formato padrao"""
    if not transportadora:
        return ''
    t = transportadora.lower().strip()
    if 'total' in t or 'tex' in t:
        return 'Total Express'
    elif 'j&t' in t or 'jt' in t or 'j t' in t or 'j e t' in t:
        return 'J&T'
    elif 'cb' in t:
        return 'CB'
    elif 'asap' in t or 'logistica e solucoes' in t or 'logística e soluções' in t:
        return 'ASAP Log'
    elif 'correios' in t or 'sedex' in t or 'pac' in t:
        return 'Correios'
    else:
        return transportadora


def get_column_mapping():
    """Retorna o mapeamento de colunas para importacao"""
    return {
        'numero_pedido': ['entrega'],
        'canal_vendas': ['nome canal de vendas'],
        'pedido_cliente': ['ped. cliente'],
        'pedido_externo': ['ped. externo'],
        'cpf_cliente': ['cpf'],
        'nome_cliente': ['nome'],
        'cep': ['cep'],
        'cidade': ['cidade'],
        'uf': ['uf'],
        'fone_cliente': ['fone'],
        'email_cliente': ['e-mail'],
        'status_pedido': ['status da entrega', 'status'],
        'data_status': ['dt.ult.ponto de controle'],
        'transportadora': ['transportadora'],
        'departamento': ['nome_5'],
        'codigo_item_bseller': ['item'],
        'produto': ['nome do produto'],
        'codigo_item_vtex': ['c?d. terceiro', 'cód. terceiro'],
        'quantidade': ['qtde pedido'],
        'preco_final': ['pre?o final', 'preço final'],
        'frete': ['frete'],
        'filial': ['uf.1'],
        'nota_fiscal': ['nota'],
        'serie_nf': ['série', 'serie'],
        'chave_nota': ['chave acesso'],
        'pedido_troca': ['pedido troca'],
        'codigo_fornecedor': ['cód. fornecedor', 'cód. fornecedor do sigeq230', 'codigo_fornecedor', 'cod. fornecedor', 'cod fornecedor', 'codfornecedor'],
        'cmv': ['cmv'],
    }


def extract_pedido_data(row, column_mapping, original_columns):
    """Extrai dados do pedido de uma linha do DataFrame"""
    pedido_data = {}
    for field, possible_names in column_mapping.items():
        for name in possible_names:
            name_lower = name.lower()
            if name_lower in original_columns:
                value = row.get(name_lower)
                if pd.notna(value):
                    str_value = str(value).strip()
                    # Remover .0 de números inteiros lidos como float pelo pandas
                    if str_value.endswith('.0') and str_value[:-2].isdigit():
                        str_value = str_value[:-2]
                    pedido_data[field] = str_value
                break
    return pedido_data


def should_skip_old_pedido(pedido_data, data_limite):
    """Verifica se o pedido deve ser ignorado por ser muito antigo"""
    if 'data_status' in pedido_data and pedido_data['data_status']:
        try:
            data_str = pedido_data['data_status'].split()[0]
            data_pedido = datetime.strptime(data_str, '%d/%m/%Y')
            data_pedido = data_pedido.replace(tzinfo=timezone.utc)
            return data_pedido < data_limite
        except (ValueError, IndexError):
            pass
    return False
