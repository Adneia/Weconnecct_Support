import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ShoppingCart, RefreshCw, ExternalLink, Check, AlertTriangle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const fmtData = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

// Data só (sem hora) — usada na coluna de tratativa
const fmtDataCurta = (iso) => {
  if (!iso) return '';
  try {
    // 'YYYY-MM-DD' puro: monta sem fuso pra não voltar 1 dia
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
};

// Badge da coluna "Tratativa" (status do ciclo do cancelamento/pedido)
const StatusTratativa = ({ status, label, data }) => {
  const dataFmt = fmtDataCurta(data);
  const cores = {
    em_tratativa: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    cancelado: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
    faturado: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    similar: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    sem_cancelamento: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  const cls = cores[status] || cores.sem_cancelamento;
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={`inline-flex items-center w-fit gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${cls}`}>
        {label || 'Sem tratativa'}
      </span>
      {dataFmt && <span className="text-[11px] text-muted-foreground">{dataFmt}</span>}
    </span>
  );
};

const AvisosCompras = () => {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos'); // todos | aberto | faturado
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();

  const fetchAvisos = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/avisos-compras`, { headers: getAuthHeader() });
      setAvisos(r.data?.avisos || []);
    } catch {
      toast.error('Erro ao carregar avisos de compras');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { fetchAvisos(); }, [fetchAvisos]);

  const tratar = async (id) => {
    if (!window.confirm('Marcar este aviso como tratado? Ele sai da lista.')) return;
    try {
      await axios.put(`${API_URL}/api/avisos-compras/${id}`, { status: 'tratado' }, { headers: getAuthHeader() });
      setAvisos(prev => prev.filter(a => a.id !== id));
      toast.success('Aviso tratado');
    } catch {
      toast.error('Não consegui tratar o aviso');
    }
  };

  const abrirPedido = (entrega) => {
    navigate(`/chamados/novo?entrega=${encodeURIComponent(String(entrega || '').split('.')[0])}`);
  };

  const lista = avisos.filter(a => (filtro === 'todos' ? true : a.status === filtro));
  const nFaturados = avisos.filter(a => a.status === 'faturado').length;
  const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const resumo = (st) => {
    const its = avisos.filter(a => a.status_tratativa === st);
    return { n: its.length, valor: its.reduce((s, a) => s + (a.valor_total || 0), 0) };
  };
  const rTratativa = resumo('em_tratativa');
  const rCancelado = resumo('cancelado');
  const rSimilar = resumo('similar');
  const rFaturado = resumo('faturado');
  const rErro = resumo('sem_cancelamento'); // aviso que NÃO migrou pro cancelamento (erro)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-red-600" />
          <h1 className="text-xl font-bold">Avisos de Compras</h1>
          {nFaturados > 0 && <Badge className="bg-orange-500 hover:bg-orange-500 text-white">{nFaturados} faturou depois</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={fetchAvisos} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        Itens que o time de Compras marcou como "não vão chegar". Clique em <strong>Abrir pedido</strong> pra tratar
        (propor similar / cancelar) e depois em <strong>Tratar</strong> pra tirar da lista. Itens laranja "faturou depois"
        voltaram a ser faturados — reveja o atendimento.
      </p>

      {/* Resumo por status (quantidade + valor do pedido: produto + frete) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Em tratativa</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-800 dark:text-amber-200">{rTratativa.n}</span>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{fmtBRL(rTratativa.valor)}</span>
          </div>
        </div>
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Cancelado</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-800 dark:text-red-200">{rCancelado.n}</span>
            <span className="text-sm font-medium text-red-700 dark:text-red-300">{fmtBRL(rCancelado.valor)}</span>
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Similar recuperado</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-800 dark:text-blue-200">{rSimilar.n}</span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{fmtBRL(rSimilar.valor)}</span>
          </div>
        </div>
        {rFaturado.n > 0 && (
          <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">Faturou depois</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-orange-800 dark:text-orange-200">{rFaturado.n}</span>
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">{fmtBRL(rFaturado.valor)}</span>
            </div>
          </div>
        )}
        {rErro.n > 0 && (
          <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300" title="Aviso que não migrou para os Cancelamentos — verificar">Pendente (não migrou)</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">{rErro.n}</span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{fmtBRL(rErro.valor)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        {['todos', 'aberto', 'faturado'].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            data-testid={`filtro-${f}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
              filtro === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-accent'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'aberto' ? 'Não vem' : '⚠ Faturou depois'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground py-10 text-center">Carregando…</div>
      ) : lista.length === 0 ? (
        <div className="text-muted-foreground py-10 text-center">Nenhum aviso pendente. 🎉</div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold">Pedido (Entrega)</th>
                <th className="px-3 py-2 font-semibold">Produto</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Estoque</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Tratativa</th>
                <th className="px-3 py-2 font-semibold">Comentário</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Quando</th>
                <th className="px-3 py-2 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(a => {
                const faturou = a.status === 'faturado';
                return (
                  <tr key={a.id} className={`border-t border-border ${faturou ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      {a.numero_pedido}
                      {a.pedido_externo && <span className="text-muted-foreground"> · {a.pedido_externo}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{a.produto || a.sku}</span>
                      {a.sku && <span className="text-muted-foreground font-mono text-xs"> · {a.sku}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span>XD: <b className={a.estoque_xd > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>{a.estoque_xd ?? 0}</b></span>
                        {a.alerta_outra_filial && a.estoque_fisico > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold"
                            title={`Estoque físico em ${(a.estoque_fisico_ufs || []).join(', ')} — entrega pela filial ${a.uf_filial_pedido || '?'}. Necessário subir pedido manual.`}
                          >
                            <AlertTriangle className="h-3 w-3" /> Físico: {a.estoque_fisico} ({(a.estoque_fisico_ufs || []).join(', ')})
                          </span>
                        ) : (
                          <span>Físico: <b className={a.estoque_fisico > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>{a.estoque_fisico ?? 0}</b>
                            {a.estoque_fisico > 0 && a.estoque_fisico_ufs?.length > 0 && (
                              <span className="text-muted-foreground"> ({a.estoque_fisico_ufs.join(', ')})</span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {faturou ? (
                        <span className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-300 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" /> Faturou depois
                        </span>
                      ) : (
                        <span className="text-red-700 dark:text-red-300">Não vem</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <StatusTratativa
                        status={a.status_tratativa}
                        label={a.status_tratativa_label}
                        data={a.status_tratativa_data}
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate" title={a.comentario || ''}>
                      {a.comentario || '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtData(a.criado_em)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => abrirPedido(a.numero_pedido)} data-testid="abrir-pedido-btn">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir pedido
                        </Button>
                        <Button variant="ghost" size="sm" className="text-emerald-700 dark:text-emerald-300" onClick={() => tratar(a.id)} data-testid="tratar-btn">
                          <Check className="h-3.5 w-3.5 mr-1" /> Tratar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AvisosCompras;
