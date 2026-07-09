"""
Módulo: Busca de Produtos Similares / Outra Tensão
Endpoint que sugere produtos alternativos quando o cliente pediu algo sem estoque.

Dois modos:
- similar:     produtos da mesma subcategoria/fornecedor com palavras-chave em comum
- outra_tensao: mesmo produto na outra tensão (127V ↔ 220V); fallback para similar+swap

Considera estoque físico (Filial 4 SC) + cross-dock (Filial 10 SC).
Se 'entrega' for informada, alerta caso o estoque esteja em filial diferente.
"""
import os
import re
import json
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
import psycopg2
from psycopg2.extras import RealDictCursor
import httpx

from utils.auth import get_current_user
from utils.database import db

VTEX_ACCOUNT = "funstock"


def _sku_vtex_id(cur, cod_terceiro: str) -> Optional[str]:
    """Retorna o sku_vtex (ID VTEX) de um cod_terceiro, via mapa_sku_vtex/ep_catalogo_vtex."""
    if not cod_terceiro:
        return None
    cur.execute("SELECT sku_vtex FROM mapa_sku_vtex WHERE UPPER(cod_terceiro)=%s AND sku_vtex IS NOT NULL LIMIT 1",
                (cod_terceiro.upper(),))
    row = cur.fetchone()
    if row and row.get("sku_vtex"):
        return str(row["sku_vtex"])
    cur.execute("SELECT vtex_sku_id FROM ep_catalogo_vtex WHERE UPPER(cod_terceiro)=%s AND vtex_sku_id IS NOT NULL LIMIT 1",
                (cod_terceiro.upper(),))
    row = cur.fetchone()
    if row and row.get("vtex_sku_id"):
        return str(row["vtex_sku_id"])
    return None


async def buscar_imagem_vtex(sku: str) -> Optional[str]:
    """Busca a URL da imagem principal de um produto (cod_terceiro) via API pública VTEX. None se não achar."""
    sku_clean = (sku or "").strip().upper()
    if not sku_clean:
        return None
    sku_vtex = None
    conn = None
    try:
        conn = _connect_pg()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            sku_vtex = _sku_vtex_id(cur, sku_clean)
    except Exception as e:
        logger.warning(f"[imagem-vtex] erro buscando sku_vtex de {sku_clean}: {e}")
        return None
    finally:
        if conn:
            conn.close()
    if not sku_vtex:
        return None
    url = f"https://{VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=skuId:{sku_vtex}"
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get(url, headers={"Accept": "application/json"})
            if r.status_code != 200:
                return None
            data = r.json()
        if not data:
            return None
        for prod in data:
            for item in (prod.get("items") or []):
                for img in (item.get("images") or []):
                    if img.get("imageUrl"):
                        return img["imageUrl"]
    except Exception as e:
        logger.warning(f"[imagem-vtex] erro API VTEX p/ {sku_clean} (sku_vtex={sku_vtex}): {e}")
    return None

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


# --- Helpers ---

STOPWORDS = {
    "de", "da", "do", "em", "com", "para", "e", "a", "o", "um", "uma",
    "os", "as", "na", "no", "por", "se", "que", "ao", "aos",
}

# Padrões de tensão para detecção e troca
# Aceita "127V", "127 V", "220v", "Bivolt" etc.
VOLT_PATTERN = re.compile(r"\b(127\s*v|220\s*v|110\s*v|bivolt|biv)\b", re.IGNORECASE)

# Mapeamento de filiais (estoque_xd.filial_id é, na verdade, o estabelecimento)
ESTAB_TO_UF = {
    4: "ES", 5: "ES",   # ES → XD (4) + WN (5)
    7: "SP", 8: "SP",   # SP → XD (7) + WN (8)
    10: "SC", 11: "SC", # SC → XD (10) + WN (11)
}
FILIAL_FISICO_TO_UF = {2: "ES", 3: "SP", 4: "SC"}


def _tokens(txt: str) -> set:
    """Quebra texto em tokens significativos (remove stopwords e tokens curtos)."""
    if not txt:
        return set()
    parts = re.split(r"[^\wÀ-ÿ]+", txt.lower())
    return {p for p in parts if len(p) > 2 and p not in STOPWORDS}


def _strip_voltagem(desc: str) -> str:
    return VOLT_PATTERN.sub("", desc or "").strip()


def _extract_voltagem(desc: str) -> Optional[str]:
    m = VOLT_PATTERN.search(desc or "")
    if not m:
        return None
    # Normaliza: "127 V" -> "127V", "BIV" -> "BIVOLT"
    v = re.sub(r"\s+", "", m.group(0)).upper()
    if v == "BIV":
        return "BIVOLT"
    return v


# Padrão de tensão no codigo_fornec — sufixos comuns:
#   -127 / -110 / -220 / -BIV (ex.: CAF338-127, CAF338-220, AGT100-BIV)
CODIGO_VOLT_PATTERN = re.compile(r"[-_/]\s*(127|220|110|biv)\b", re.IGNORECASE)


def _extract_voltagem_codigo(codigo_fornec: str) -> Optional[str]:
    """Tenta extrair a tensão do código do fornecedor (sufixos -127 / -220 / -BIV)."""
    if not codigo_fornec:
        return None
    m = CODIGO_VOLT_PATTERN.search(codigo_fornec)
    if not m:
        return None
    v = m.group(1).upper()
    return "BIVOLT" if v == "BIV" else v + "V"


def _detectar_voltagem(item: dict) -> Optional[str]:
    """Detecta tensão olhando descrição e, se não achar, o codigo_fornec."""
    v = _extract_voltagem(item.get("descricao") or "")
    if v:
        return v
    return _extract_voltagem_codigo(item.get("codigo_fornec") or "")


def _voltagem_oposta(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    v = v.upper()
    if v == "127V":
        return "220V"
    if v == "220V":
        return "127V"
    if v == "110V":
        return "220V"
    return None  # Bivolt ou outra: sem oposta clara


def _connect_pg():
    return psycopg2.connect(
        host=os.getenv("PG_HOST"),
        port=os.getenv("PG_PORT", "5432"),
        dbname=os.getenv("PG_DB", "bigdata"),
        user=os.getenv("PG_USER"),
        password=os.getenv("PG_PASSWORD"),
        connect_timeout=10,
    )


def _resolver_cod_terceiro(cur, termo: str) -> Optional[str]:
    """Aceita SKU (cod_terceiro), código do fornecedor ou ID BSeller (id_item_bseller)
    e devolve o cod_terceiro correspondente. None se não achar de nenhuma forma."""
    t = (termo or "").strip().upper()
    if not t:
        return None
    # 1) SKU direto
    cur.execute("SELECT cod_terceiro FROM itens WHERE UPPER(cod_terceiro)=%s LIMIT 1", (t,))
    row = cur.fetchone()
    if row:
        return row["cod_terceiro"]
    # 2) ID BSeller (numérico)
    if t.isdigit():
        cur.execute(
            "SELECT cod_terceiro FROM itens WHERE id_item_bseller::text=%s "
            "ORDER BY (status='Aberto') DESC, cod_terceiro LIMIT 1", (t,))
        row = cur.fetchone()
        if row:
            return row["cod_terceiro"]
    # 3) Código do fornecedor (pode haver mais de um item; prioriza status Aberto)
    cur.execute(
        "SELECT cod_terceiro FROM itens WHERE UPPER(codigo_fornec)=%s "
        "ORDER BY (status='Aberto') DESC, cod_terceiro LIMIT 1", (t,))
    row = cur.fetchone()
    if row:
        return row["cod_terceiro"]
    return None


def _carrega_produto(cur, cod_terceiro: str) -> Optional[dict]:
    """Carrega ficha do produto + estoque consolidado."""
    cur.execute(
        """
        SELECT i.cod_terceiro,
               i.id_item_bseller,
               i.codigo_fornec,
               i.ean,
               i.descricao,
               i.status,
               i.abc_class,
               i.categoria,
               i.subcategoria,
               COALESCE(v.fisico_total, 0)       AS fisico_total,
               COALESCE(v.fisico_disponivel, 0)  AS fisico_disponivel,
               COALESCE(v.xd_total, 0)           AS xd_total,
               COALESCE(v.total_disponivel, 0)   AS total_disponivel
        FROM itens i
        LEFT JOIN v_estoque_consolidado v ON v.cod_terceiro = i.cod_terceiro
        WHERE UPPER(i.cod_terceiro) = %s
        LIMIT 1
        """,
        (cod_terceiro.upper(),),
    )
    row = cur.fetchone()
    if not row:
        return None
    # Filiais com estoque físico > 0 (último snapshot)
    cur.execute(
        """
        SELECT filial_id, SUM(qtd_disponivel) AS qtd
        FROM (
          SELECT DISTINCT ON (filial_id, deposito_id) filial_id, deposito_id, qtd_disponivel
          FROM estoque_fisico
          WHERE cod_terceiro = %s
          ORDER BY filial_id, deposito_id, snapshot_date DESC
        ) t
        GROUP BY filial_id
        HAVING SUM(qtd_disponivel) > 0
        """,
        (row["cod_terceiro"],),
    )
    filiais_fisico = {r["filial_id"]: int(r["qtd"]) for r in cur.fetchall()}
    # Estabelecimentos XD
    cur.execute(
        """
        SELECT filial_id, SUM(disp_venda) AS qtd
        FROM (
          SELECT DISTINCT ON (filial_id) filial_id, disp_venda
          FROM estoque_xd
          WHERE cod_terceiro = %s AND tipo_deposito = 'XD'
          ORDER BY filial_id, snapshot_date DESC
        ) t
        GROUP BY filial_id
        HAVING SUM(disp_venda) > 0
        """,
        (row["cod_terceiro"],),
    )
    xd_por_estab = {r["filial_id"]: int(r["qtd"]) for r in cur.fetchall()}
    row["filiais_fisico"] = filiais_fisico  # {4: 12, ...}
    row["xd_por_estab"] = xd_por_estab      # {10: 100, ...}
    # UFs com estoque (consolidado: físico ∪ XD)
    ufs = set()
    for f, q in filiais_fisico.items():
        u = FILIAL_FISICO_TO_UF.get(f)
        if u and q > 0:
            ufs.add(u)
    for e, q in xd_por_estab.items():
        u = ESTAB_TO_UF.get(e)
        if u and q > 0:
            ufs.add(u)
    row["ufs_com_estoque"] = sorted(ufs)
    return dict(row)


def _ultimo_preco_compra(cur, cod_terceiro: str) -> float:
    """Preço de última compra (registro mais recente em precos_compra_hist). 0 se não houver."""
    if not cod_terceiro:
        return 0.0
    cur.execute(
        """
        SELECT preco FROM precos_compra_hist
        WHERE cod_terceiro = %s AND preco > 0
        ORDER BY data_alteracao DESC NULLS LAST LIMIT 1
        """,
        (cod_terceiro,),
    )
    row = cur.fetchone()
    try:
        return float(row["preco"]) if row and row.get("preco") else 0.0
    except Exception:
        return 0.0


def _ultimo_preco_venda(cur, cod_terceiro: str) -> float:
    """Preço de venda atual (precos_venda.preco_por mais recente). 0 se não houver."""
    if not cod_terceiro:
        return 0.0
    cur.execute(
        """
        SELECT preco_por FROM precos_venda
        WHERE cod_terceiro = %s AND preco_por > 0
        ORDER BY valid_from DESC NULLS LAST LIMIT 1
        """,
        (cod_terceiro,),
    )
    row = cur.fetchone()
    try:
        return float(row["preco_por"]) if row and row.get("preco_por") else 0.0
    except Exception:
        return 0.0


def _candidatos_similares(cur, original: dict, limit: int = 30,
                          original_custo: float = 0, valor_vendido: float = 0,
                          original_preco_venda: float = 0,
                          preco_venda_fator: float = 1.0) -> List[dict]:
    """Busca candidatos similares por subcategoria + categoria, com estoque > 0.
    Regra de custo (preço de última compra):
      - candidato >= custo do original (não oferecer item inferior)
      - candidato <= valor vendido do pedido (não exceder o que o cliente pagou)
    Regra de preço de venda (fallback / regra adicional):
      - candidato.preco_venda >= original.preco_venda * preco_venda_fator
      - preco_venda_fator=1.0 (padrão) = piso de 100% do original;
        chamada pode passar 0.8 (fallback) quando o filtro estrito zerar candidatos.
      - Aplica sempre que o original tem preco_venda > 0; candidato sem preco_venda é mantido.
    Cada limite só é aplicado quando o valor correspondente é conhecido (>0).
    Candidato sem preço de compra é mantido (não dá pra confirmar) e marcado custo=0."""
    subcat = original.get("subcategoria") or ""
    cat = original.get("categoria") or ""
    cur.execute(
        """
        SELECT i.cod_terceiro, i.id_item_bseller, i.codigo_fornec, i.ean,
               i.descricao, i.status, i.abc_class, i.categoria, i.subcategoria,
               COALESCE(v.fisico_disponivel, 0) AS fisico_disponivel,
               COALESCE(v.xd_total, 0)          AS xd_total,
               COALESCE(v.total_disponivel, 0)  AS total_disponivel,
               COALESCE(pc.preco, 0)            AS custo,
               COALESCE(pv.preco_por, 0)        AS preco_venda
        FROM itens i
        LEFT JOIN v_estoque_consolidado v ON v.cod_terceiro = i.cod_terceiro
        LEFT JOIN LATERAL (
            SELECT preco FROM precos_compra_hist p
            WHERE p.cod_terceiro = i.cod_terceiro AND p.preco > 0
            ORDER BY p.data_alteracao DESC NULLS LAST LIMIT 1
        ) pc ON TRUE
        LEFT JOIN LATERAL (
            SELECT preco_por FROM precos_venda v2
            WHERE v2.cod_terceiro = i.cod_terceiro AND v2.preco_por > 0
            ORDER BY v2.valid_from DESC NULLS LAST LIMIT 1
        ) pv ON TRUE
        WHERE i.cod_terceiro != %s
          AND i.status = 'Aberto'
          AND COALESCE(v.total_disponivel, 0) > 0
          AND (i.subcategoria = %s OR (i.subcategoria IS NULL AND i.categoria = %s))
        ORDER BY i.cod_terceiro
        LIMIT 5000
        """,
        (original["cod_terceiro"], subcat, cat),
    )
    rows = [dict(r) for r in cur.fetchall()]

    # Filtro de custo (preço de última compra). Limites aplicados só quando conhecidos.
    def custo_ok(r):
        c = float(r.get("custo") or 0)
        if c <= 0:
            return True  # sem preço de compra: não dá pra confirmar, mantém
        if original_custo and original_custo > 0 and c < float(original_custo):
            return False  # inferior ao original → não serve
        if valor_vendido and valor_vendido > 0 and c > float(valor_vendido):
            return False  # custa mais que o valor vendido → prejuízo
        return True
    rows = [r for r in rows if custo_ok(r)]

    # Filtro de preço de venda: não oferecer item de valor inferior ao original.
    # Usado especialmente quando custo do original não está cadastrado em precos_compra_hist
    # (caso comum), evitando que itens significativamente mais baratos sejam propostos.
    if original_preco_venda and original_preco_venda > 0:
        piso = float(original_preco_venda) * float(preco_venda_fator or 1.0)
        def preco_venda_ok(r):
            pv = float(r.get("preco_venda") or 0)
            if pv <= 0:
                return True  # sem preço de venda cadastrado: mantém (não dá pra avaliar)
            return pv >= piso
        rows = [r for r in rows if preco_venda_ok(r)]

    # Filtro de tensão: um similar precisa ter a MESMA tensão do original.
    # Produto com tensão diferente não é "similar" — seria caso de "outra tensão".
    # Detecta tensão tanto na descrição quanto no codigo_fornec (sufixos -127/-220/-BIV).
    # Aceita candidatos com a mesma voltagem, sem voltagem identificável ou Bivolt.
    volt_original = _detectar_voltagem(original)
    if volt_original and volt_original != "BIVOLT":
        def voltagem_ok(r):
            v = _detectar_voltagem(r)
            return v is None or v == volt_original or v == "BIVOLT"
        rows = [r for r in rows if voltagem_ok(r)]

    # Ordena por similaridade de tokens com a descrição original (ignorando a voltagem no texto)
    desc_clean = _strip_voltagem(original.get("descricao") or "")
    desc_tokens = _tokens(desc_clean)
    # "Palavra principal" = primeiro token significativo da descrição (geralmente o tipo do produto:
    # Disco, Frigideira, Escorredor, Nobreak...). Um similar de verdade compartilha esse substantivo.
    desc_lista = [w for w in re.split(r"[^\wÀ-ÿ]+", desc_clean.lower()) if len(w) > 2 and w not in STOPWORDS]
    palavra_principal = desc_lista[0] if desc_lista else None

    def score(r):
        t = _tokens(_strip_voltagem(r.get("descricao") or ""))
        if not desc_tokens or not t:
            return 0
        return len(desc_tokens & t) / max(1, len(desc_tokens | t))

    def eh_similar_de_verdade(r):
        t = _tokens(_strip_voltagem(r.get("descricao") or ""))
        # Quando há palavra principal identificável (caso comum), EXIGE que o candidato
        # compartilhe. Sem isso, candidatos de outra categoria (ex.: "Fritadeira Oster"
        # x "Chaleira Oster") entravam só pela sobreposição de marca/voltagem.
        if palavra_principal:
            # Match exato OU substring (>= 5 chars) — aceita "Processador" ↔
            # "Miniprocessador" ↔ "Multiprocessador", "Panela" ↔ "Panelas" etc.
            if palavra_principal in t:
                return True
            if len(palavra_principal) >= 5:
                for tk in t:
                    if len(tk) >= 5 and (palavra_principal in tk or tk in palavra_principal):
                        return True
            return False
        # Sem palavra principal identificável (descrição genérica): cai pra Jaccard >= 0.34.
        return score(r) >= 0.34

    # Remove candidatos sem relação real (ex.: "Disco de Processador" x "Escorredor de Louças")
    rows = [r for r in rows if eh_similar_de_verdade(r)]
    rows.sort(key=score, reverse=True)
    return rows[:limit]


# --- Endpoint ---


@router.get("/produtos/imagem/{sku}")
async def get_imagem_produto(sku: str, current_user: dict = Depends(get_current_user)):
    """Retorna a URL da imagem do produto (via VTEX). {sku, image_url}."""
    url = await buscar_imagem_vtex(sku)
    return {"sku": sku.strip().upper(), "image_url": url}


# Limite de XD em outra filial: abaixo disso, propõe similar; acima, alerta p/ subir pedido.
_LIMITE_XD_OUTRA_FILIAL = 50


@router.get("/produtos/estoque/{sku}")
async def get_estoque_produto(sku: str, entrega: Optional[str] = None,
                              current_user: dict = Depends(get_current_user)):
    """Estoque (físico + XD) de um SKU por filial, com a DECISÃO de ação para o card
    do atendimento. Regras (pedido sem estoque na origem):
      - Físico na filial de origem      → nada
      - Físico só em outra filial       → alerta_fisico_outra_filial (subir pedido manual)
      - XD na filial de origem          → nada
      - XD só em outra filial < 50 un   → propor_similar
      - XD só em outra filial >= 50 un  → alerta_xd_outra_filial (subir pedido manual)
      - Sem físico e sem XD             → propor_similar
    """
    sku_clean = (sku or "").strip().upper()
    vazio = {"found": False, "fisico_total": 0, "xd_total": 0, "fisico_por_uf": {},
             "xd_por_uf": {}, "uf_entrega": None, "acao": "nada", "xd_outras": 0,
             "ufs_fisico": [], "ufs_xd": []}
    conn = None
    try:
        conn = _connect_pg()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            p = _carrega_produto(cur, sku_clean)
            if not p:
                return vazio
            cod = p.get("cod_terceiro") or sku_clean
            # Estoque DISPONÍVEL por filial — ÚLTIMO snapshot global (mesma lógica da
            # v_estoque_consolidado). Usa qtd_disponivel/disp_venda (exclui reservado e
            # snapshots antigos/depósitos não-vendáveis).
            cur.execute(
                """SELECT filial_id, SUM(qtd_disponivel) AS qtd
                   FROM estoque_fisico
                   WHERE cod_terceiro = %s
                     AND snapshot_date = (SELECT MAX(snapshot_date) FROM estoque_fisico)
                   GROUP BY filial_id HAVING SUM(qtd_disponivel) > 0""",
                (cod,),
            )
            fisico_rows = cur.fetchall()
            cur.execute(
                """SELECT filial_id, SUM(disp_venda) AS qtd
                   FROM estoque_xd
                   WHERE cod_terceiro = %s AND tipo_deposito = 'XD'
                     AND snapshot_date = (SELECT MAX(snapshot_date) FROM estoque_xd)
                   GROUP BY filial_id HAVING SUM(disp_venda) > 0""",
                (cod,),
            )
            xd_rows = cur.fetchall()

        # Estoque DISPONÍVEL por UF (físico e XD)
        fisico_por_uf, xd_por_uf = {}, {}
        for r in fisico_rows:
            uf = FILIAL_FISICO_TO_UF.get(r["filial_id"])
            if uf:
                fisico_por_uf[uf] = fisico_por_uf.get(uf, 0) + int(r["qtd"])
        for r in xd_rows:
            uf = ESTAB_TO_UF.get(r["filial_id"])
            if uf:
                xd_por_uf[uf] = xd_por_uf.get(uf, 0) + int(r["qtd"])

        # UF de origem do pedido (filial que atende a entrega)
        uf_entrega = None
        if entrega:
            ent = str(entrega).strip().split(".")[0]
            pe = await db.pedidos_erp.find_one({"numero_pedido": ent}, {"_id": 0, "filial": 1, "uf": 1})
            if pe:
                uf_entrega = (pe.get("filial") or pe.get("uf") or "").strip().upper() or None

        fisico_origem = fisico_por_uf.get(uf_entrega, 0) if uf_entrega else 0
        fisico_outras = sum(q for uf, q in fisico_por_uf.items() if uf != uf_entrega)
        xd_origem = xd_por_uf.get(uf_entrega, 0) if uf_entrega else 0
        xd_outras = sum(q for uf, q in xd_por_uf.items() if uf != uf_entrega)

        # Decisão
        if fisico_origem > 0:
            acao = "nada"
        elif fisico_outras > 0:
            acao = "alerta_fisico_outra_filial"
        elif xd_origem > 0:
            acao = "nada"
        elif xd_outras > 0:
            acao = "propor_similar" if xd_outras < _LIMITE_XD_OUTRA_FILIAL else "alerta_xd_outra_filial"
        else:
            acao = "propor_similar"

        return {
            "found": True,
            "sku": p.get("cod_terceiro"),
            "fisico_total": sum(fisico_por_uf.values()),
            "xd_total": sum(xd_por_uf.values()),
            "fisico_por_uf": fisico_por_uf,
            "xd_por_uf": xd_por_uf,
            "uf_entrega": uf_entrega,
            "xd_outras": xd_outras,
            "ufs_fisico": sorted(fisico_por_uf.keys()),
            "ufs_xd": sorted(xd_por_uf.keys()),
            "acao": acao,
        }
    except Exception as e:
        logger.warning(f"[estoque] {sku_clean}: {e}")
        return vazio
    finally:
        if conn:
            conn.close()


@router.get("/produtos/sugerir-similar")
async def sugerir_similar(
    sku: str,
    tipo: str = "similar",  # 'similar' | 'outra_tensao'
    entrega: Optional[str] = None,
    max_propostos: int = 3,
    current_user: dict = Depends(get_current_user),
):
    if tipo not in ("similar", "outra_tensao"):
        raise HTTPException(status_code=400, detail="tipo deve ser 'similar' ou 'outra_tensao'")

    sku_clean = sku.strip().upper()

    # Dados da entrega (mongo) — buscados antes para ajustar filtro de custo em NiceQuest
    uf_entrega = None
    parceiro_entrega = None
    produto_entrega = None
    eh_nicequest = False
    if entrega:
        entrega_clean = str(entrega).strip().split(".")[0]
        pe = await db.pedidos_erp.find_one(
            {"numero_pedido": entrega_clean},
            {"_id": 0, "filial": 1, "uf": 1, "canal_vendas": 1, "produto": 1}
        )
        if pe:
            uf_entrega = (pe.get("filial") or "").strip().upper() or None
            parceiro_entrega = (pe.get("canal_vendas") or "").strip() or None
            produto_entrega = (pe.get("produto") or "").strip() or None
            if parceiro_entrega and parceiro_entrega.lower() in ("nicequest", "ncq"):
                eh_nicequest = True

    conn = None
    try:
        conn = _connect_pg()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Aceita SKU, código do fornecedor ou ID BSeller
            cod_resolvido = _resolver_cod_terceiro(cur, sku_clean) or sku_clean
            original = _carrega_produto(cur, cod_resolvido)
            if not original:
                raise HTTPException(
                    status_code=404,
                    detail=f"'{sku_clean}' não encontrado no catálogo (procurei por SKU, código de fornecedor e ID do produto)")
            sku_clean = original["cod_terceiro"]

            voltagem_original = _extract_voltagem(original.get("descricao") or "")
            voltagem_alvo = _voltagem_oposta(voltagem_original) if tipo == "outra_tensao" else None
            propostos: List[dict] = []
            aviso_fallback = None

            if tipo == "outra_tensao":
                if not voltagem_original:
                    aviso_fallback = "Produto original não tem tensão identificável — caindo para busca similar."
                elif not voltagem_alvo:
                    aviso_fallback = f"Voltagem '{voltagem_original}' sem tensão oposta clara (Bivolt?) — caindo para busca similar."
                else:
                    # Procura mesmo produto na outra tensão: troca a voltagem na descrição e busca
                    desc_alvo = VOLT_PATTERN.sub(voltagem_alvo, original["descricao"])
                    cur.execute(
                        """
                        SELECT i.cod_terceiro, i.id_item_bseller, i.codigo_fornec, i.ean,
                               i.descricao, i.status, i.abc_class, i.categoria, i.subcategoria,
                               COALESCE(v.fisico_disponivel, 0) AS fisico_disponivel,
                               COALESCE(v.xd_total, 0)          AS xd_total,
                               COALESCE(v.total_disponivel, 0)  AS total_disponivel
                        FROM itens i
                        LEFT JOIN v_estoque_consolidado v ON v.cod_terceiro = i.cod_terceiro
                        WHERE i.cod_terceiro != %s
                          AND i.status = 'Aberto'
                          AND LOWER(i.descricao) = LOWER(%s)
                          AND COALESCE(v.total_disponivel, 0) > 0
                        LIMIT 5
                        """,
                        (original["cod_terceiro"], desc_alvo),
                    )
                    propostos = [dict(r) for r in cur.fetchall()]
                    if not propostos:
                        aviso_fallback = (
                            f"Não encontrei {voltagem_alvo} do mesmo produto com estoque. "
                            f"Mostrando similares (atenção à tensão)."
                        )

            # Se ainda não temos propostos: cai para busca similar (com filtro de custo)
            preco_fallback_aplicado = False
            if not propostos:
                # NiceQuest: pedido pago em pontos (preco_final ~ R$0,01) — filtro de custo
                # bloqueia qualquer candidato. Desliga o teto pra esse canal.
                _orig_custo = 0.0 if eh_nicequest else _ultimo_preco_compra(cur, sku_clean)
                # Preço de venda do original — usado como piso pra não oferecer item inferior.
                _orig_preco_venda = _ultimo_preco_venda(cur, sku_clean)
                # Tenta primeiro com piso de 100% do preço de venda do original.
                propostos = _candidatos_similares(cur, original, limit=max_propostos,
                                                  original_custo=_orig_custo,
                                                  original_preco_venda=_orig_preco_venda,
                                                  preco_venda_fator=1.0)
                # Se zerou tudo, relaxa pra 80% e marca aviso.
                if not propostos and _orig_preco_venda > 0:
                    propostos = _candidatos_similares(cur, original, limit=max_propostos,
                                                      original_custo=_orig_custo,
                                                      original_preco_venda=_orig_preco_venda,
                                                      preco_venda_fator=0.8)
                    if propostos:
                        preco_fallback_aplicado = True
                        if not aviso_fallback:
                            aviso_fallback = "Não achei similar de igual valor; mostrando próximos (até 20% abaixo)."

            propostos = propostos[:max_propostos]

            # Valores do original (venda + custo de última compra) p/ comparação na tela
            original["custo"] = _ultimo_preco_compra(cur, original["cod_terceiro"])
            original["preco_venda"] = _ultimo_preco_venda(cur, original["cod_terceiro"])

            # Enriquece cada proposto com filiais (pra checagem de entrega) + valores
            for p in propostos:
                enriched = _carrega_produto(cur, p["cod_terceiro"])
                if enriched:
                    p["filiais_fisico"] = enriched["filiais_fisico"]
                    p["xd_por_estab"] = enriched["xd_por_estab"]
                    p["ufs_com_estoque"] = enriched["ufs_com_estoque"]
                if not p.get("custo"):
                    p["custo"] = _ultimo_preco_compra(cur, p["cod_terceiro"])
                if not p.get("preco_venda"):
                    p["preco_venda"] = _ultimo_preco_venda(cur, p["cod_terceiro"])

        # Filial/parceiro/produto da entrega já foram carregados no topo (eh_nicequest depende deles).

        # Alertas por proposto: estoque em UF diferente da entrega
        for p in propostos:
            p["alerta_filial"] = None
            if uf_entrega and p.get("ufs_com_estoque"):
                if uf_entrega not in p["ufs_com_estoque"]:
                    ufs_str = ", ".join(p["ufs_com_estoque"])
                    p["alerta_filial"] = (
                        f"Estoque está em {ufs_str}, mas a entrega é {uf_entrega}. "
                        f"Necessário subir pedido manual."
                    )

        return {
            "tipo": tipo,
            "voltagem_original": voltagem_original,
            "voltagem_alvo": voltagem_alvo,
            "aviso_fallback": aviso_fallback,
            "preco_fallback_aplicado": preco_fallback_aplicado,
            "entrega": entrega,
            "uf_entrega": uf_entrega,
            "parceiro_entrega": parceiro_entrega,
            "produto_entrega": produto_entrega,
            "original": original,
            "propostos": propostos,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[sugerir-similar] failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


async def computar_similares_compactos(sku: str, entrega: Optional[str] = None, max_propostos: int = 5) -> dict:
    """
    Versão reutilizável (sem HTTP) para o fluxo de Cancelamentos AES.
    Busca SIMILARES (mesma tensão) com estoque para o SKU dado.
    Retorna {found, original_nome, propostos:[{sku,nome,id_bseller,xd,ufs,alerta_filial}], uf_entrega, parceiro}.
    Nunca levanta exceção — em erro retorna found=False.
    """
    out = {"found": False, "original_nome": "", "propostos": [], "uf_entrega": None, "parceiro": None}
    if not sku:
        return out
    sku_clean = sku.strip().upper()

    # Valor vendido do pedido (o que o cliente pagou) — teto do custo do similar.
    # NiceQuest: pago em pontos (preco_final ~ R$0,01) — desliga filtros de custo.
    valor_vendido = 0.0
    eh_nicequest = False
    try:
        if entrega:
            pe = await db.pedidos_erp.find_one(
                {"numero_pedido": str(entrega).strip().split(".")[0]},
                {"_id": 0, "preco_final": 1, "canal_vendas": 1})
            if pe:
                if pe.get("preco_final"):
                    valor_vendido = float(str(pe["preco_final"]).replace(",", "."))
                canal = (pe.get("canal_vendas") or "").strip().lower()
                if canal in ("nicequest", "ncq"):
                    eh_nicequest = True
                    valor_vendido = 0.0
    except Exception:
        valor_vendido = 0.0

    conn = None
    try:
        conn = _connect_pg()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            original = _carrega_produto(cur, sku_clean)
            if not original:
                return out
            out["original_nome"] = original.get("descricao") or ""
            # Custo do original = preço de última compra (precos_compra_hist).
            # NiceQuest: zera p/ liberar candidatos (pedido em pontos, não em R$).
            original_custo = 0.0 if eh_nicequest else _ultimo_preco_compra(cur, sku_clean)
            # Preço de venda do original — usado como piso (não oferecer item de valor inferior).
            original_preco_venda = _ultimo_preco_venda(cur, sku_clean)
            # Tenta primeiro com piso de 100%; se zerar, relaxa pra 80% com aviso.
            cands = _candidatos_similares(cur, original, limit=max_propostos,
                                          original_custo=original_custo, valor_vendido=valor_vendido,
                                          original_preco_venda=original_preco_venda,
                                          preco_venda_fator=1.0)
            if not cands and original_preco_venda > 0:
                cands = _candidatos_similares(cur, original, limit=max_propostos,
                                              original_custo=original_custo, valor_vendido=valor_vendido,
                                              original_preco_venda=original_preco_venda,
                                              preco_venda_fator=0.8)
                if cands:
                    out["aviso_preco"] = "Não achei similar de igual valor; mostrando próximos (até 20% abaixo)."
            for p in cands:
                enriched = _carrega_produto(cur, p["cod_terceiro"])
                if enriched:
                    p["ufs_com_estoque"] = enriched["ufs_com_estoque"]
                    p["xd_por_estab"] = enriched["xd_por_estab"]
    except Exception as e:
        logger.warning(f"[computar_similares] falhou para {sku_clean}: {e}")
        return out
    finally:
        if conn:
            conn.close()

    # UF/parceiro da entrega (Mongo)
    uf_entrega = None
    parceiro = None
    if entrega:
        entrega_clean = str(entrega).strip().split(".")[0]
        pe = await db.pedidos_erp.find_one(
            {"numero_pedido": entrega_clean},
            {"_id": 0, "filial": 1, "canal_vendas": 1},
        )
        if pe:
            uf_entrega = (pe.get("filial") or "").strip().upper() or None
            parceiro = (pe.get("canal_vendas") or "").strip() or None
    out["uf_entrega"] = uf_entrega
    out["parceiro"] = parceiro

    propostos = []
    for p in cands:
        ufs = p.get("ufs_com_estoque") or []
        alerta = None
        if uf_entrega and ufs and uf_entrega not in ufs:
            alerta = f"Estoque em {', '.join(ufs)}, entrega {uf_entrega} — subir pedido manual."
        propostos.append({
            "sku": p["cod_terceiro"],
            "nome": p.get("descricao") or "",
            "id_bseller": str(p.get("id_item_bseller") or ""),
            "xd": int(p.get("xd_total") or 0),
            "ufs": ufs,
            "alerta_filial": alerta,
        })
    out["propostos"] = propostos
    out["found"] = len(propostos) > 0
    return out
