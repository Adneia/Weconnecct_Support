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

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-red-600" />
          <h1 className="text-xl font-bold">Avisos de Compras</h1>
          <Badge variant="secondary">{avisos.length} pendente{avisos.length !== 1 ? 's' : ''}</Badge>
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
                <th className="px-3 py-2 font-semibold">Status</th>
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
                    <td className="px-3 py-2 whitespace-nowrap">
                      {faturou ? (
                        <span className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-300 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" /> Faturou depois
                        </span>
                      ) : (
                        <span className="text-red-700 dark:text-red-300">Não vem</span>
                      )}
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
