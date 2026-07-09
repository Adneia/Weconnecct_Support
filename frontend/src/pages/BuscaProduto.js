import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Package, Zap, AlertCircle, AlertTriangle, CheckCircle2, Copy, MessageCircle, X, ImageOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Mapeamentos filial → UF (sincronizado com backend)
const FILIAL_FISICO_TO_UF = { 2: 'ES', 3: 'SP', 4: 'SC' };
const ESTAB_TO_UF = { 4: 'ES', 5: 'ES', 7: 'SP', 8: 'SP', 10: 'SC', 11: 'SC' };
const ESTAB_TIPO = { 4: 'XD', 5: 'WN', 7: 'XD', 8: 'WN', 10: 'XD', 11: 'WN' };

function copiar(texto, msg = 'Copiado!') {
  navigator.clipboard.writeText(texto).then(() => toast.success(msg));
}

const formatMoney = (v) => (v == null || isNaN(v))
  ? '—'
  : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Modal com os textos automáticos p/ envio ao cliente (mesmo padrão do WhatsApp
// Similar de Cancelamentos). `similares` = lista de propostos selecionados.
function TextosModal({ orig, similares, entrega, imgMap, onClose }) {
  const [abertos, setAbertos] = useState({ 0: true });
  const toggleTexto = (i) => setAbertos(prev => ({ ...prev, [i]: !prev[i] }));

  const produto = orig?.descricao || '[produto]';
  const linkSufixo = (url) => (url ? ` - ${url}` : '');
  const linkOriginal = imgMap[orig?.cod_terceiro] || '';
  const fmtSim = (p) => {
    const nome = p.descricao || p.cod_terceiro;
    const id = p.id_item_bseller ? ` (ID: ${p.id_item_bseller})` : '';
    return `${nome}${id}${linkSufixo(imgMap[p.cod_terceiro] || '')}`;
  };
  const multiplos = similares.length > 1;
  const blocoInicial = multiplos
    ? `Temos como alternativa os seguintes itens similares:\n${similares.map((p, i) => `${i + 1}) ${fmtSim(p)}`).join('\n')}\nPoderia confirmar se aceita a substituição por um deles?`
    : `Temos como alternativa um item similar: ${fmtSim(similares[0])}. Poderia confirmar se aceita a substituição pelo item similar?`;
  const blocoAceita = multiplos
    ? `os novos itens:\n${similares.map((p, i) => `${i + 1}) ${fmtSim(p)}`).join('\n')}`
    : `o novo item - ${fmtSim(similares[0])}`;
  const refEntrega = entrega ? ` - ${entrega}` : '';

  const templates = [
    {
      label: 'Mensagem inicial',
      emoji: '💬',
      texto: `${saudacao()}\nInfelizmente, tivemos uma falha sistêmica no item ${produto}${refEntrega}${linkSufixo(linkOriginal)}\n${blocoInicial}\nAguardamos retorno e seguimos à disposição.\nAtenciosamente!\nAtendimento Weconnect`,
    },
    {
      label: 'Cliente não aceita',
      emoji: '❌',
      texto: `Agradecemos a confirmação, Iremos acionar o canal de troca/venda para estornar os valores pagos. Nossas sinceras desculpas pelo ocorrido.\nAtenciosamente!\nAtendimento Weconnect`,
    },
    {
      label: 'Cliente aceita',
      emoji: '✅',
      texto: `Agradecemos a confirmação, seguiremos com a preparação d${multiplos ? 'os' : 'o'} ${blocoAceita}.\nNossas sinceras desculpas pelo ocorrido.\nAtenciosamente!\nAtendimento Weconnect`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl mx-4 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base flex items-center gap-2">
            <span>📱</span> Textos p/ cliente — Similar
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 space-y-0.5">
          <div><strong>Produto:</strong> {produto}</div>
          {entrega && <div><strong>Entrega:</strong> {entrega}</div>}
          <div className="flex items-start gap-1">
            <strong>{multiplos ? 'Similares:' : 'Similar:'}</strong>
            <span>{similares.map((p, i) => (
              <span key={p.cod_terceiro} className="block">
                {multiplos ? `${i + 1}) ` : ''}{p.descricao || p.cod_terceiro}{p.id_item_bseller ? ` (ID: ${p.id_item_bseller})` : ''}
              </span>
            ))}</span>
          </div>
        </div>

        {templates.map((t, i) => (
          <div key={t.label} className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800">
              <button onClick={() => toggleTexto(i)} className="text-sm font-semibold flex items-center gap-2">
                <span>{t.emoji}</span> {t.label}
              </button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copiar(t.texto, `${t.label} copiado!`)}>
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
            </div>
            {abertos[i] && (
              <pre className="px-3 py-2 text-xs whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300">{t.texto}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StockBadge({ qtd }) {
  if (qtd > 0) {
    return <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">{qtd} <CheckCircle2 className="h-3.5 w-3.5" /></span>;
  }
  return <span className="inline-flex items-center gap-1 text-amber-700 font-medium">{qtd} <AlertTriangle className="h-3.5 w-3.5" /></span>;
}

function ProdutoColuna({ titulo, prod, alerta, destaque }) {
  if (!prod) return <td className="px-3 py-2 text-slate-400">—</td>;
  return (
    <td className={`px-3 py-2 align-top ${destaque ? 'bg-amber-50/40' : ''}`}>
      <div className="font-semibold text-sm">{titulo}</div>
      {alerta && (
        <div className="mt-1 text-xs flex items-start gap-1 text-red-600 font-medium">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{alerta}</span>
        </div>
      )}
    </td>
  );
}

export default function BuscaProduto() {
  const { getAuthHeader } = useAuth();
  const [sku, setSku] = useState('');
  const [tipo, setTipo] = useState('similar');
  const [entrega, setEntrega] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [imgMap, setImgMap] = useState({});          // cod_terceiro -> url da imagem (VTEX)
  const [imgFalhou, setImgFalhou] = useState({});    // cod_terceiro -> true (sem imagem)
  const [textosDe, setTextosDe] = useState(null);    // lista de propostos p/ o modal de textos

  // Busca lazy das imagens (original + propostos) quando chega um resultado
  useEffect(() => {
    if (!resultado?.original) return;
    const skus = [resultado.original, ...(resultado.propostos || [])]
      .map(p => p?.cod_terceiro).filter(Boolean);
    skus.filter(sk => !imgMap[sk] && !imgFalhou[sk]).forEach(sk => {
      axios.get(`${API_URL}/api/produtos/imagem/${encodeURIComponent(sk)}`, { headers: getAuthHeader() })
        .then(r => {
          if (r.data?.image_url) setImgMap(prev => ({ ...prev, [sk]: r.data.image_url }));
          else setImgFalhou(prev => ({ ...prev, [sk]: true }));
        })
        .catch(() => setImgFalhou(prev => ({ ...prev, [sk]: true })));
    });
  }, [resultado]); // eslint-disable-line

  const buscar = async (e) => {
    e?.preventDefault();
    if (!sku.trim()) { toast.error('Informe SKU, código de fornecedor ou ID do produto'); return; }
    setLoading(true); setError(''); setResultado(null);
    try {
      const params = { sku: sku.trim().toUpperCase(), tipo };
      if (entrega.trim()) params.entrega = entrega.trim();
      const res = await axios.get(`${API_URL}/api/produtos/sugerir-similar`, { params, headers: getAuthHeader() });
      setResultado(res.data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Erro na busca';
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const orig = resultado?.original;
  const propostos = resultado?.propostos || [];

  // Render filiais físicas como "SC dep.69: 12"
  const fmtFisico = (filiais_fisico = {}) => {
    const itens = Object.entries(filiais_fisico).map(([fid, qtd]) => {
      const uf = FILIAL_FISICO_TO_UF[Number(fid)] || `F${fid}`;
      return { uf, qtd };
    });
    return itens;
  };
  // XD por estab
  const fmtXd = (xd_por_estab = {}) => {
    return Object.entries(xd_por_estab).map(([eid, qtd]) => {
      const uf = ESTAB_TO_UF[Number(eid)] || '?';
      const tipo = ESTAB_TIPO[Number(eid)] || '?';
      return { uf, tipo, estab: eid, qtd };
    });
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl space-y-4">
      <div className="flex items-center gap-3">
        <Search className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Buscar Produto</h1>
          <p className="text-sm text-muted-foreground">Sugere produtos com estoque para oferta — similar ou outra tensão. Busque por SKU, código de fornecedor ou ID do produto.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">O que precisa?</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={buscar} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3 space-y-1">
              <Label htmlFor="sku">SKU, cód. fornecedor ou ID</Label>
              <Input id="sku" value={sku} onChange={e => setSku(e.target.value.toUpperCase())} placeholder="Ex: JCS0201, CAF338-127 ou 2845211" className="font-mono" />
            </div>
            <div className="md:col-span-4 space-y-1">
              <Label>Necessidade</Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setTipo('similar')}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm flex items-center justify-center gap-2 transition-colors ${
                    tipo === 'similar' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}>
                  <Package className="h-4 w-4" /> Similar
                </button>
                <button type="button" onClick={() => setTipo('outra_tensao')}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm flex items-center justify-center gap-2 transition-colors ${
                    tipo === 'outra_tensao' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}>
                  <Zap className="h-4 w-4" /> Outra tensão
                </button>
              </div>
            </div>
            <div className="md:col-span-3 space-y-1">
              <Label htmlFor="entrega">Entrega (opcional)</Label>
              <Input id="entrega" value={entrega} onChange={e => setEntrega(e.target.value)} placeholder="Para checar UF do destino" className="font-mono" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Buscando...' : <><Search className="h-4 w-4 mr-1" /> Buscar</>}
              </Button>
            </div>
          </form>
          {error && (
            <p className="mt-3 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4" /> {error}</p>
          )}
        </CardContent>
      </Card>

      {resultado && orig && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
              <span>Sugestão de {tipo === 'outra_tensao' ? 'outra tensão' : 'similar'}</span>
              <div className="text-xs font-normal text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                {resultado.uf_entrega && <span>Entrega: <span className="font-semibold text-slate-800 dark:text-slate-200">{resultado.uf_entrega}</span></span>}
                {resultado.parceiro_entrega && (
                  <span>Parceiro: <span className="font-semibold text-blue-700 dark:text-blue-400">{resultado.parceiro_entrega}</span></span>
                )}
                {resultado.voltagem_original && (
                  <span>
                    Tensão: <span className="font-semibold">{resultado.voltagem_original}</span>
                    {resultado.voltagem_alvo && <> → <span className="font-semibold text-blue-700">{resultado.voltagem_alvo}</span></>}
                  </span>
                )}
              </div>
            </CardTitle>
            {resultado.aviso_fallback && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{resultado.aviso_fallback}</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left bg-slate-50 w-44">&nbsp;</th>
                  <ProdutoColuna titulo={`${orig.cod_terceiro} — original`} prod={orig} destaque />
                  {propostos.map((p, i) => (
                    <ProdutoColuna key={p.cod_terceiro} titulo={`${p.cod_terceiro} — Proposto (${i + 1})`} prod={p} alerta={p.alerta_filial} />
                  ))}
                  {propostos.length === 0 && (
                    <td className="px-3 py-4 text-center text-slate-500">Nenhum proposto encontrado com estoque.</td>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* Imagem do produto (VTEX) */}
                <tr className="border-b">
                  <th className="px-3 py-1.5 text-left font-medium text-slate-600 bg-slate-50">Imagem</th>
                  {[orig, ...propostos].map((p, idx) => (
                    <td key={idx} className={`px-3 py-2 ${idx === 0 ? 'bg-amber-50/30' : ''}`}>
                      {imgMap[p.cod_terceiro] ? (
                        <a href={imgMap[p.cod_terceiro]} target="_blank" rel="noopener noreferrer" title="Abrir imagem">
                          <img src={imgMap[p.cod_terceiro]} alt={p.descricao || p.cod_terceiro}
                               className="h-24 w-24 object-contain rounded border bg-white" />
                        </a>
                      ) : imgFalhou[p.cod_terceiro] ? (
                        <span className="inline-flex h-24 w-24 items-center justify-center rounded border bg-slate-50 text-slate-300">
                          <ImageOff className="h-6 w-6" />
                        </span>
                      ) : (
                        <span className="inline-flex h-24 w-24 items-center justify-center rounded border bg-slate-50 text-[10px] text-slate-400">carregando…</span>
                      )}
                    </td>
                  ))}
                </tr>
                {[
                  { label: 'cod_terceiro',    get: p => p.cod_terceiro },
                  { label: 'id_item_bseller', get: p => p.id_item_bseller },
                  { label: 'codigo_fornec',   get: p => p.codigo_fornec },
                  { label: 'EAN',             get: p => p.ean },
                  { label: 'Descrição',       get: p => p.descricao },
                  { label: 'Status',          get: p => `${p.status}${p.abc_class ? ` · classe ${p.abc_class}` : ''}` },
                  { label: 'Preço de venda',  get: p => <span className="font-semibold text-emerald-700">{formatMoney(p.preco_venda || null)}</span> },
                  { label: 'Custo (últ. compra)', get: p => formatMoney(p.custo || null) },
                ].map(({ label, get }) => (
                  <tr key={label} className="border-b">
                    <th className="px-3 py-1.5 text-left font-medium text-slate-600 bg-slate-50">{label}</th>
                    <td className="px-3 py-1.5 bg-amber-50/30">{get(orig) ?? '—'}</td>
                    {propostos.map(p => (
                      <td key={p.cod_terceiro + label} className="px-3 py-1.5">{get(p) ?? '—'}</td>
                    ))}
                  </tr>
                ))}
                {/* Estoque header */}
                <tr className="border-b bg-slate-100/60">
                  <th colSpan={2 + propostos.length} className="px-3 py-1.5 text-left font-semibold text-slate-700">
                    Estoque
                  </th>
                </tr>
                {/* Físico por filial (UF) */}
                <tr className="border-b">
                  <th className="px-3 py-1.5 text-left font-medium text-slate-600 bg-slate-50">Físico</th>
                  {[orig, ...propostos].map((p, idx) => (
                    <td key={idx} className={`px-3 py-1.5 ${idx === 0 ? 'bg-amber-50/30' : ''}`}>
                      {fmtFisico(p.filiais_fisico).length === 0 ? <span className="text-slate-400">0</span>
                        : fmtFisico(p.filiais_fisico).map(({ uf, qtd }) => (
                          <div key={uf}>{uf}: <StockBadge qtd={qtd} /></div>
                        ))}
                    </td>
                  ))}
                </tr>
                {/* XD (cross-dock) */}
                <tr className="border-b">
                  <th className="px-3 py-1.5 text-left font-medium text-slate-600 bg-slate-50">XD (Cross-dock)</th>
                  {[orig, ...propostos].map((p, idx) => (
                    <td key={idx} className={`px-3 py-1.5 ${idx === 0 ? 'bg-amber-50/30' : ''}`}>
                      {fmtXd(p.xd_por_estab).length === 0 ? <span className="text-slate-400">0</span>
                        : fmtXd(p.xd_por_estab).map(({ uf, qtd }) => (
                          <div key={uf}>{uf}: <StockBadge qtd={qtd} /></div>
                        ))}
                    </td>
                  ))}
                </tr>
                {/* UFs com estoque (resumo) */}
                <tr className="border-b">
                  <th className="px-3 py-1.5 text-left font-medium text-slate-600 bg-slate-50">UFs com estoque</th>
                  {[orig, ...propostos].map((p, idx) => (
                    <td key={idx} className={`px-3 py-1.5 ${idx === 0 ? 'bg-amber-50/30' : ''}`}>
                      {(p.ufs_com_estoque || []).join(', ') || <span className="text-slate-400">—</span>}
                    </td>
                  ))}
                </tr>
                {/* Ações */}
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600 bg-slate-50 align-top">
                    {propostos.length > 1 && (
                      <button
                        onClick={() => setTextosDe(propostos)}
                        className="text-xs px-2 py-1 rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1 font-normal"
                        title="Gera os textos oferecendo TODOS os propostos"
                      >
                        <MessageCircle className="h-3 w-3" /> Textos (todos)
                      </button>
                    )}
                  </th>
                  <td className="px-3 py-2 bg-amber-50/30 text-xs text-slate-500 align-top">(original)</td>
                  {propostos.map(p => (
                    <td key={p.cod_terceiro + '_act'} className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => copiar(p.cod_terceiro, 'SKU copiado!')}
                          className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" /> SKU
                        </button>
                        <button
                          onClick={() => setTextosDe([p])}
                          className="text-xs px-2 py-1 rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"
                          title="Gera os textos p/ oferecer este similar ao cliente"
                        >
                          <MessageCircle className="h-3 w-3" /> Textos
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {textosDe && orig && (
        <TextosModal
          orig={orig}
          similares={textosDe}
          entrega={entrega.trim()}
          imgMap={imgMap}
          onClose={() => setTextosDe(null)}
        />
      )}
    </div>
  );
}
