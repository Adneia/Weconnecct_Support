from datetime import datetime, timezone, timedelta
import pandas as pd


def parse_date_safe(date_value) -> datetime:
    """Parse date value to timezone-aware datetime"""
    if date_value is None:
        return datetime.now(timezone.utc)
    
    if isinstance(date_value, str):
        try:
            dt = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
        except:
            try:
                dt = pd.to_datetime(date_value).to_pydatetime()
            except:
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
    """Calcula a quantidade de dias úteis entre duas datas"""
    if data_fim is None:
        data_fim = datetime.now(timezone.utc)
    
    if isinstance(data_inicio, str):
        try:
            data_str = data_inicio.split()[0]
            data_inicio = datetime.strptime(data_str, '%d/%m/%Y')
            data_inicio = data_inicio.replace(tzinfo=timezone.utc)
        except:
            return 0
    
    if data_inicio.tzinfo is None:
        data_inicio = data_inicio.replace(tzinfo=timezone.utc)
    if data_fim.tzinfo is None:
        data_fim = data_fim.replace(tzinfo=timezone.utc)
    
    dias_uteis = 0
    data_atual = data_inicio
    while data_atual < data_fim:
        if data_atual.weekday() < 5:  # Segunda a Sexta
            dias_uteis += 1
        data_atual += timedelta(days=1)
    
    return dias_uteis

def is_status_maiusculo(status):
    """Verifica se o status está todo em maiúsculas (indicando tracking)"""
    if not status:
        return False
    clean_status = status.strip()
    return len(clean_status) >= 4 and clean_status.isupper()

def get_galpao_from_serie(serie_nf, chave_nota=None):
    """Determina o galpão baseado na série da NF e chave de acesso"""
    serie = str(serie_nf).strip() if serie_nf else ''
    chave = str(chave_nota).strip() if chave_nota else ''
    
    # Série 6 = São Paulo, Série 4 = Santa Catarina
    if serie == '6':
        return {'galpao': 'São Paulo', 'uf_galpao': 'SP', 'filial': 'SP'}
    elif serie == '4':
        return {'galpao': 'Santa Catarina', 'uf_galpao': 'SC', 'filial': 'SC'}
    
    # Tentar extrair da chave de acesso (posição 0-1 é o UF)
    if len(chave) >= 2:
        uf_code = chave[:2]
        uf_map = {
            '35': ('São Paulo', 'SP'),
            '42': ('Santa Catarina', 'SC'),
            '32': ('Espírito Santo', 'ES'),
        }
        if uf_code in uf_map:
            nome, uf = uf_map[uf_code]
            return {'galpao': nome, 'uf_galpao': uf, 'filial': uf}
    
    return {'galpao': '', 'uf_galpao': '', 'filial': ''}

def serialize_datetime(obj):
    """Serializa datetime para ISO string"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def serialize_doc(doc):
    """Serializa todos os campos datetime de um documento"""
    for key, value in doc.items():
        doc[key] = serialize_datetime(value)
    return doc
