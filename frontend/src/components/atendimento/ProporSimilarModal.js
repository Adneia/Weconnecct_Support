import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Copy, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const copiar = (texto, msg) => {
  navigator.clipboard.writeText(texto || '').then(() => toast.success(msg || 'Copiado!'));
};

/**
 * Modal "Propor Similar" para a tela de Atendimento.
 * Reaproveita o fluxo do AES: localiza similares (estoque) e gera os textos padrão.
 * Props: { pedido (pedidoErp), onClose }
 */
export default function ProporSimilarModal({ pedido, onClose }) {
  const { getAuthHeader } = useAuth();
  const produto = pedido?.produto || '[produto]';
  const entrega = pedido?.numero_pedido || '[entrega]';
  const skuOriginal = pedido?.codigo_item_vtex || '';

  const [loading, setLoading] = useState(true);
  const [propostos, setPropostos] = useState([]);   // [{sku,nome,id_bseller,xd,ufs,alerta_filial}]
  const [ufEntrega, setUfEntrega] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [imgMap, setImgMap] = useState({});

  // Busca similares (mesmo endpoint do AES: /produtos/sugerir-similar)
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    axios.get(`${API_URL}/api/produtos/sugerir-similar`, {
      params: { sku: skuOriginal, entrega: String(entrega).split('.')[0], max_propostos: 5 },
      headers: getAuthHeader(),
    }).then(r => {
      if (!ativo) return;
      const lista = (r.data?.propostos || []).map(p => ({
        sku: p.cod_terceiro,
        nome: p.descricao,
        id_bseller: p.id_item_bseller ? String(p.id_item_bseller) : '',
        xd: p.xd_total || 0,
        ufs: p.ufs_com_estoque || [],
        alerta_filial: p.alerta_filial || null,
      }));
      setPropostos(lista);
      setUfEntrega(r.data?.uf_entrega || null);
      setSel(new Set(lista.map(s => s.sku)));  // por padrão, todos selecionados
    }).catch(() => {
      if (ativo) { setPropostos([]); }
    }).finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [skuOriginal, entrega, getAuthHeader]);

  // Busca lazy das imagens (original + similares)
  useEffect(() => {
    const skus = [skuOriginal, ...propostos.map(p => p.sku)].filter(Boolean);
    skus.filter(sk => imgMap[sk] === undefined).forEach(sk => {
      axios.get(`${API_URL}/api/produtos/imagem/${encodeURIComponent(sk)}`, { headers: getAuthHeader() })
        .then(r => setImgMap(prev => ({ ...prev, [sk]: r.data?.image_url || '' })))
        .catch(() => setImgMap(prev => ({ ...prev, [sk]: '' })));
    });
  }, [propostos, skuOriginal, getAuthHeader]); // eslint-disable-line

  const toggle = (sku) => setSel(prev => {
    const n = new Set(prev); n.has(sku) ? n.delete(sku) : n.add(sku); return n;
  });

  const escolhidos = propostos.filter(p => sel.has(p.sku));
  const multi = escolhidos.length > 1;
  const linkOriginal = imgMap[skuOriginal] || '';
  const sufixo = (url) => url ? ` - ${url}` : '';
  const fmtSim = (s) => (s.id_bseller ? `${s.nome} (ID: ${s.id_bseller})` : s.nome);
  const fmtSimLink = (s) => `${fmtSim(s)}${sufixo(imgMap[s.sku] || '')}`;

  const blocoInicial = multi
    ? `Temos como alternativa os seguintes itens similares:\n${escolhidos.map((s, i) => `${i + 1}) ${fmtSimLink(s)}`).join('\n')}\nPoderia confirmar se aceita a substituição por um deles?`
    : (escolhidos[0]
        ? `Temos como alternativa um item similar: ${fmtSimLink(escolhidos[0])}. Poderia confirmar se aceita a substituição pelo item similar?`
        : 'Poderia confirmar se aceita a substituição por um item similar?');
  const blocoAceita = multi
    ? `os novos itens:\n${escolhidos.map((s, i) => `${i + 1}) ${fmtSimLink(s)}`).join('\n')}`
    : (escolhidos[0] ? `o novo item - ${fmtSimLink(escolhidos[0])}` : 'o novo item');

  const templates = [
    {
      label: 'Mensagem inicial', emoji: '💬',
      texto: `Boa tarde\nInfelizmente, tivemos uma falha sistêmica no item ${produto} - ${entrega}${sufixo(linkOriginal)}\n${blocoInicial}\nAguardamos retorno e seguimos à disposição.\nAtenciosamente!\nAtendimento Weconnect`,
    },
    {
      label: 'Cliente não aceita', emoji: '❌',
      texto: `Agradecemos a confirmação, Iremos acionar o canal de troca/venda para estornar os valores pagos. Nossas sinceras desculpas pelo ocorrido.\nAtenciosamente!\nAtendimento Weconnect`,
    },
    {
      label: 'Cliente aceita', emoji: '✅',
      texto: `Agradecemos a confirmação, seguiremos com a preparação d${multi ? 'os' : 'o'} ${blocoAceita}.\nNossas sinceras desculpas pelo ocorrido.\nAtenciosamente!\nAtendimento Weconnect`,
    },
  ];

  const foneDigits = (pedido?.fone_cliente || '').replace(/\D/g, '');
  const wa = foneDigits ? (foneDigits.length <= 11 ? `55${foneDigits}` : foneDigits) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl mx-4 p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base flex items-center gap-2"><span>🔄</span> Propor Similar — sem estoque</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 space-y-0.5">
          <div><strong>Produto:</strong> {produto} <span className="text-slate-400">({skuOriginal})</span></div>
          <div><strong>Entrega:</strong> {entrega}{ufEntrega ? ` · UF ${ufEntrega}` : ''}</div>
          {pedido?.nome_cliente && <div><strong>Cliente:</strong> {pedido.nome_cliente}</div>}
          {wa && (
            <div className="flex items-center gap-2">
              <strong>Telefone:</strong>
              <button onClick={() => copiar(pedido.fone_cliente, 'Telefone copiado!')} className="font-mono hover:text-blue-600 hover:underline">{pedido.fone_cliente}</button>
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 text-[11px] font-semibold">📱 WhatsApp</a>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center animate-pulse">Localizando similares com estoque...</div>
        ) : propostos.length === 0 ? (
          <div className="text-sm py-6 text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
            Nenhum similar com estoque encontrado para este item.
          </div>
        ) : (
          <>
            {/* Seleção de similares */}
            <div className="space-y-1">
              <div className="text-xs font-semibold text-purple-700">🔎 Similares sugeridos (com estoque):</div>
              <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto">
                {propostos.map(s => (
                  <label key={s.sku} className="flex items-start gap-1 text-[12px] cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                    <input type="checkbox" checked={sel.has(s.sku)} onChange={() => toggle(s.sku)} className="mt-0.5" />
                    <span className="leading-tight">
                      <span className="block text-slate-700 font-medium">{s.nome}</span>
                      <span className="block text-[10px] text-slate-500">
                        <span className="font-mono hover:text-blue-600 hover:underline cursor-pointer" onClick={(e) => { e.preventDefault(); copiar(s.sku, `SKU ${s.sku} copiado!`); }}>{s.sku}</span>
                        {s.id_bseller ? <span> · ID {s.id_bseller}</span> : null}
                        {s.xd > 0 && <span className="text-emerald-600"> · XD {s.xd}</span>}
                        {s.ufs?.length > 0 && <span className="text-slate-400"> ({s.ufs.join('/')})</span>}
                      </span>
                      {s.alerta_filial && <span className="block text-red-600 text-[10px]">⚠️ {s.alerta_filial}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Imagens: original x similares */}
            {(linkOriginal || escolhidos.some(s => imgMap[s.sku])) && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-600">🖼️ Comparação (clique para abrir / copiar link):</div>
                <div className="flex flex-wrap gap-3 items-start">
                  {linkOriginal && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-500">ORIGINAL</span>
                      <a href={linkOriginal} target="_blank" rel="noopener noreferrer"><img src={linkOriginal} alt={produto} className="w-24 h-24 object-contain border-2 border-slate-300 rounded bg-white" /></a>
                      <button onClick={() => copiar(linkOriginal, 'Link do original copiado!')} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border text-slate-600">📋 Copiar link</button>
                    </div>
                  )}
                  {linkOriginal && escolhidos.some(s => imgMap[s.sku]) && <div className="self-center text-2xl text-slate-300">→</div>}
                  {escolhidos.filter(s => imgMap[s.sku]).map(s => (
                    <div key={s.sku} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-green-600">SIMILAR</span>
                      <a href={imgMap[s.sku]} target="_blank" rel="noopener noreferrer"><img src={imgMap[s.sku]} alt={s.nome} className="w-24 h-24 object-contain border-2 border-green-300 rounded bg-white" /></a>
                      <button onClick={() => copiar(imgMap[s.sku], 'Link do similar copiado!')} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border text-slate-600">📋 Copiar link</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Textos padrão */}
            <div className="space-y-3">
              {templates.map((t, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{t.emoji} {t.label}</span>
                    <button onClick={() => copiar(t.texto, `"${t.label}" copiado!`)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-semibold border border-green-300">
                      <Copy className="h-3 w-3" /> Copiar
                    </button>
                  </div>
                  <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded p-2 font-sans leading-relaxed">{t.texto}</pre>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
