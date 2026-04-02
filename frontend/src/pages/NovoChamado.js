import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2, Search, Package, Truck, User, MapPin,
  Phone, Mail, ShoppingBag, Copy,
  FileText, Building, AlertCircle, CheckCircle,
  RotateCcw, ChevronDown, ChevronUp
} from 'lucide-react';

// Components
import TextosCategoriaButtons from '../components/atendimento/TextosCategoriaButtons';
import SecaoAnotacoes from '../components/atendimento/SecaoAnotacoes';
import AcoesFormulario from '../components/atendimento/AcoesFormulario';

// Constants & Texts
import { CATEGORIAS, MOTIVOS_FINALIZADORES } from '../components/atendimento/constants';
import {
  TEXTOS_MOTIVO_PENDENCIA, TEXTOS_AVARIA, TEXTOS_FALHA_PRODUCAO,
  TEXTOS_FALHA_TRANSPORTE, TEXTOS_ARREPENDIMENTO, TEXTOS_ACOMPANHAMENTO,
  TEXTOS_RECLAME_AQUI, TEXTOS_ASSISTENCIA, TEXTO_FALHA_INTEGRACAO,
  TEXTOS_REVERSA_ASSISTENCIA,
  getCategoriaPorStatus, getTransportadoraRastreio,
} from '../components/atendimento/textos';
import { replaceAllPlaceholders } from '../components/atendimento/textReplacer';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const NovoAtendimento = () => {
  const { id: atendimentoId } = useParams();
  const isEditMode = !!atendimentoId;
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const filterParam = searchParams.get('filter');

  // --- State ---
  const [loading, setLoading] = useState(false);
  const [loadingAtendimento, setLoadingAtendimento] = useState(false);
  const [searchingPedido, setSearchingPedido] = useState(false);
  const [pedidoNotFound, setPedidoNotFound] = useState(false);
  const [modoFalhaIntegracao, setModoFalhaIntegracao] = useState(false);
  const [pedidoErp, setPedidoErp] = useState(null);
  const [anotacoesOriginais, setAnotacoesOriginais] = useState('');
  const [pedidosList, setPedidosList] = useState([]);
  const [showPedidosDialog, setShowPedidosDialog] = useState(false);
  const [showTextoDialog, setShowTextoDialog] = useState(false);
  const [textoPadrao, setTextoPadrao] = useState('');
  const textoAreaRef = useRef(null);
  const [codigoReversa, setCodigoReversa] = useState('');
  const [atendimentoOriginal, setAtendimentoOriginal] = useState(null);

  const getDefaultVencimento = () => {
    const date = new Date();
    date.setDate(date.getDate() + 10);
    return date.toISOString().split('T')[0];
  };
  const [dataVencimentoReversa, setDataVencimentoReversa] = useState(getDefaultVencimento());

  const [searchType, setSearchType] = useState('pedido');
  const [selectedGalpao, setSelectedGalpao] = useState('SP');
  const [searchValue, setSearchValue] = useState('');
  const [selectedAvaria, setSelectedAvaria] = useState('');
  const [selectedFalhaProducao, setSelectedFalhaProducao] = useState('');
  const [selectedFalhaTransporte, setSelectedFalhaTransporte] = useState('');
  const [selectedFalhaFornecedor, setSelectedFalhaFornecedor] = useState('');
  const [selectedArrependimento, setSelectedArrependimento] = useState('');
  const [selectedAcompanhamento, setSelectedAcompanhamento] = useState('');
  const [selectedReclameAqui, setSelectedReclameAqui] = useState('');
  const [selectedAssistencia, setSelectedAssistencia] = useState('');
  const [selectedComprovante, setSelectedComprovante] = useState('');
  const [selectedMotivoPendencia, setSelectedMotivoPendencia] = useState('');
  const [selectedAssistenciaAguardando, setSelectedAssistenciaAguardando] = useState('');
  const [motivoPendencia, setMotivoPendencia] = useState('');
  const [transportadoraDetectada, setTransportadoraDetectada] = useState(null);
  const [retornarChamado, setRetornarChamado] = useState(false);
  const [verificarAdneia, setVerificarAdneia] = useState(false);
  const [encerrarAoCriar, setEncerrarAoCriar] = useState(false);
  const [pedidoExpanded, setPedidoExpanded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    solicitacao: false, categoria: false, motivo: false, motivoPendencia: false, anotacoes: false
  });
  const [showDevolucaoDialog, setShowDevolucaoDialog] = useState(false);
  const [devolucaoRegistrada, setDevolucaoRegistrada] = useState(false);
  const [existingAtendimento, setExistingAtendimento] = useState(null);
  const [showExistingDialog, setShowExistingDialog] = useState(false);
  const [categoriaInicial, setCategoriaInicial] = useState('');
  const [statusDevolucao, setStatusDevolucao] = useState('');
  const [pendingSubmitData, setPendingSubmitData] = useState(null);

  const [formData, setFormData] = useState({
    numero_pedido: '', solicitacao: '', parceiro: '',
    categoria: '', categoria_inicial: '', motivo: '',
    anotacoes: '', atendente: ''
  });

  const navigate = useNavigate();
  const { getAuthHeader, user } = useAuth();

  // Context for text replacement
  const getTextContext = () => ({ user, formData, pedidoErp, codigoReversa, dataVencimentoReversa });

  // --- Effects ---
  useEffect(() => {
    if (user?.name && !isEditMode) {
      setFormData(prev => ({ ...prev, atendente: user.name }));
    }
  }, [user, isEditMode]);

  const [skipSearchEffect, setSkipSearchEffect] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Pular busca automática quando carregando chamado em modo edição
      if (skipSearchEffect) {
        setSkipSearchEffect(false);
        return;
      }
      if (searchValue.trim().length >= 3) {
        if (searchType === 'entrega') searchByEntrega(searchValue.trim());
        else if (searchType === 'cpf') searchByCpf(searchValue.trim());
        else if (searchType === 'nome') searchByNome(searchValue.trim());
        else if (searchType === 'pedido') searchByPedido(searchValue.trim());
        else if (searchType === 'galpao') searchByGalpaoNota(selectedGalpao, searchValue.trim());
      } else {
        setPedidoErp(null);
        setPedidosList([]);
        setPedidoNotFound(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue, searchType, selectedGalpao]);

  useEffect(() => {
    if (isEditMode && atendimentoId) loadAtendimento(atendimentoId);
  }, [atendimentoId, isEditMode]);

  // --- Business Logic ---
  const loadAtendimento = async (id) => {
    setLoadingAtendimento(true);
    try {
      const response = await axios.get(`${API_URL}/api/chamados/${id}`, { headers: getAuthHeader() });
      const atd = response.data;
      setAtendimentoOriginal(atd);

      setFormData({
        numero_pedido: atd.numero_pedido || '', solicitacao: atd.solicitacao || '',
        parceiro: atd.parceiro || atd.canal_vendas || '', categoria: atd.categoria || '',
        categoria_inicial: atd.categoria_inicial || atd.categoria || '',
        motivo: atd.motivo || '', anotacoes: atd.anotacoes || '',
        atendente: atd.atendente || 'Letícia Martelo',
        pendente: atd.pendente !== undefined ? atd.pendente : true
      });
      setAnotacoesOriginais(atd.anotacoes || '');
      if (atd.motivo_pendencia) setMotivoPendencia(atd.motivo_pendencia);
      if (atd.reversa_codigo || atd.codigo_reversa) setCodigoReversa(atd.reversa_codigo || atd.codigo_reversa);
      if (atd.data_vencimento_reversa) {
        let dataVenc = atd.data_vencimento_reversa;
        if (dataVenc && dataVenc.includes('/') && !dataVenc.includes('-')) {
          const parts = dataVenc.split('/');
          if (parts.length === 2) {
            const dia = parts[0].padStart(2, '0');
            const mes = parts[1].padStart(2, '0');
            dataVenc = `2026-${mes}-${dia}`;
          }
        }
        setDataVencimentoReversa(dataVenc);
      }
      if (atd.retornar_chamado !== undefined) setRetornarChamado(atd.retornar_chamado);
      if (atd.verificar_adneia !== undefined) setVerificarAdneia(atd.verificar_adneia);
      if (atd.status_devolucao) setStatusDevolucao(atd.status_devolucao);

      if (atd.numero_pedido) {
        setSkipSearchEffect(true);
        setSearchValue(atd.numero_pedido);
        setSearchType('entrega');
        try {
          const pedidoResponse = await axios.get(`${API_URL}/api/pedidos-erp/${atd.numero_pedido}`, { headers: getAuthHeader() });
          if (pedidoResponse.data) {
            setPedidoErp(pedidoResponse.data);
            setTransportadoraDetectada(getTransportadoraRastreio(pedidoResponse.data.transportadora));
          }
        } catch (e) { console.log('Pedido ERP não encontrado'); }
      }
      toast.success('Atendimento carregado');
    } catch (error) {
      console.error('Erro ao carregar atendimento:', error);
      toast.error('Erro ao carregar atendimento');
    } finally { setLoadingAtendimento(false); }
  };

  const processarPedido = async (pedido) => {
    if (!isEditMode) {
      try {
        const response = await axios.get(
          `${API_URL}/api/chamados?search=${pedido.numero_pedido}&search_type=entrega`,
          { headers: getAuthHeader() }
        );
        if (response.data && response.data.length > 0) {
          setExistingAtendimento(response.data[0]);
          setShowExistingDialog(true);
        }
      } catch (error) { console.error('Erro ao verificar atendimentos existentes:', error); }
    }
    setPedidoErp(pedido);
    const { categoria, motivo } = getCategoriaPorStatus(pedido.status_pedido);
    const transpRastreio = getTransportadoraRastreio(pedido.transportadora);
    setTransportadoraDetectada(transpRastreio);
    setFormData(prev => ({
      ...prev, numero_pedido: pedido.numero_pedido,
      parceiro: pedido.canal_vendas || '', categoria: categoria || prev.categoria
    }));
    if (categoria && !categoriaInicial) setCategoriaInicial(categoria);
    if (motivo) setMotivoPendencia(motivo);
    if (transpRastreio && categoria === 'Falha Produção') setSelectedFalhaProducao(transpRastreio);
  };

  // --- Search Functions ---
  const searchByEntrega = async (entrega) => {
    setSearchingPedido(true); setPedidoErp(null); setPedidoNotFound(false);
    try {
      const response = await axios.get(`${API_URL}/api/pedidos-erp/${entrega}`, { headers: getAuthHeader() });
      processarPedido(response.data); setPedidoNotFound(false);
    } catch (error) {
      if (error.response?.status === 404) setPedidoNotFound(true);
      else toast.error('Erro ao buscar pedido');
    } finally { setSearchingPedido(false); }
  };

  const searchMultiple = async (url, errorMsg) => {
    setSearchingPedido(true); setPedidoErp(null); setPedidosList([]); setPedidoNotFound(false);
    try {
      const response = await axios.get(url, { headers: getAuthHeader() });
      if (response.data.length === 0) setPedidoNotFound(true);
      else if (response.data.length === 1) processarPedido(response.data[0]);
      else { setPedidosList(response.data); setShowPedidosDialog(true); }
    } catch { toast.error(errorMsg); }
    finally { setSearchingPedido(false); }
  };

  const searchByCpf = (cpf) => searchMultiple(`${API_URL}/api/pedidos-erp/buscar/cpf/${cpf}`, 'Erro ao buscar por CPF');
  const searchByNome = (nome) => searchMultiple(`${API_URL}/api/pedidos-erp/buscar/nome/${encodeURIComponent(nome)}`, 'Erro ao buscar por nome');
  const searchByPedido = (pedido) => searchMultiple(`${API_URL}/api/pedidos-erp/buscar/pedido/${encodeURIComponent(pedido)}`, 'Erro ao buscar por pedido');
  const searchByGalpaoNota = (galpao, nota) => searchMultiple(`${API_URL}/api/pedidos-erp/buscar/galpao/${encodeURIComponent(galpao)}/nota/${encodeURIComponent(nota)}`, 'Erro ao buscar por galpão/nota');
  const selectPedido = (pedido) => { processarPedido(pedido); setShowPedidosDialog(false); };

  // --- Text Loading Functions (simplified with replaceAllPlaceholders) ---
  const loadTextoPadrao = async (categoria) => {
    try {
      const response = await axios.get(`${API_URL}/api/textos-padroes/${encodeURIComponent(categoria)}`, { headers: getAuthHeader() });
      setTextoPadrao(replaceAllPlaceholders(response.data.texto, getTextContext()));
      setShowTextoDialog(true);
    } catch { toast.error('Erro ao carregar texto padrão'); }
  };

  const loadTextoAvaria = (tipo) => {
    setTextoPadrao(replaceAllPlaceholders(TEXTOS_AVARIA[tipo] || '', getTextContext()));
    setSelectedAvaria(tipo); setShowTextoDialog(true);
  };
  const loadTextoFalhaProducao = (tipo) => {
    setTextoPadrao(replaceAllPlaceholders(TEXTOS_FALHA_PRODUCAO[tipo] || '', getTextContext()));
    setSelectedFalhaProducao(tipo); setShowTextoDialog(true);
  };
  const loadTextoFalhaTransporte = (tipo) => {
    setTextoPadrao(replaceAllPlaceholders(TEXTOS_FALHA_TRANSPORTE[tipo] || '', getTextContext()));
    setSelectedFalhaTransporte(tipo); setShowTextoDialog(true);
  };
  const loadTextoFalhaFornecedor = async (tipo) => {
    try {
      const response = await axios.get(`${API_URL}/api/textos-padroes/${encodeURIComponent(`Falha Fornecedor - ${tipo}`)}`, { headers: getAuthHeader() });
      setTextoPadrao(replaceAllPlaceholders(response.data.texto, getTextContext()));
      setSelectedFalhaFornecedor(tipo);
      setSelectedAssistenciaAguardando(tipo);
      setShowTextoDialog(true);
    } catch { toast.error('Erro ao carregar texto padrão'); }
  };
  const loadTextoArrependimento = (tipo) => {
    setTextoPadrao(replaceAllPlaceholders(TEXTOS_ARREPENDIMENTO[tipo] || '', getTextContext()));
    setSelectedArrependimento(tipo); setShowTextoDialog(true);
  };
  const loadTextoAcompanhamento = (tipo) => {
    setTextoPadrao(replaceAllPlaceholders(TEXTOS_ACOMPANHAMENTO[tipo] || '', getTextContext()));
    setSelectedAcompanhamento(tipo); setShowTextoDialog(true);
  };
  const loadTextoReclameAqui = (tipo) => {
    setTextoPadrao(replaceAllPlaceholders(TEXTOS_RECLAME_AQUI[tipo] || '', getTextContext()));
    setSelectedReclameAqui(tipo); setShowTextoDialog(true);
  };
  const loadTextoAssistencia = (tipo) => {
    setTextoPadrao(replaceAllPlaceholders(TEXTOS_ASSISTENCIA[tipo] || '', getTextContext()));
    setSelectedAssistencia(tipo); setShowTextoDialog(true);
  };
  const loadTextoComprovante = async (tipo) => {
    try {
      const response = await axios.get(`${API_URL}/api/textos-padroes/${encodeURIComponent(`Comprovante de Entrega - ${tipo}`)}`, { headers: getAuthHeader() });
      setTextoPadrao(replaceAllPlaceholders(response.data.texto, getTextContext()));
      setSelectedComprovante(tipo);
      setSelectedMotivoPendencia(`Comprovante - ${tipo}`);
      setShowTextoDialog(true);
    } catch { toast.error('Erro ao carregar texto de comprovante'); }
  };
  const loadTextoMotivoPendencia = (tipo) => {
    setTextoPadrao(replaceAllPlaceholders(TEXTOS_MOTIVO_PENDENCIA[tipo] || '', getTextContext()));
    setSelectedMotivoPendencia(tipo); setShowTextoDialog(true);
  };
  const loadTextoReversaAssistencia = (fornecedor) => {
    setTextoPadrao(replaceAllPlaceholders(TEXTOS_REVERSA_ASSISTENCIA[fornecedor] || '', getTextContext()));
    setSelectedAssistenciaAguardando(`Reversa Assistência - ${fornecedor}`); setShowTextoDialog(true);
  };
  const handleLoadTextoRaw = (texto, _titulo) => {
    setTextoPadrao(replaceAllPlaceholders(texto, getTextContext()));
    setShowTextoDialog(true);
  };

  const isReclameAqui = () => formData.solicitacao && formData.solicitacao.toLowerCase().includes('reclame');

  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => toast.success('Texto copiado!')).catch(() => toast.error('Erro ao copiar'));
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.top = '-9999px';
      el.style.left = '-9999px';
      el.setAttribute('readonly', '');
      document.body.appendChild(el);
      el.focus();
      el.select();
      el.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      if (ok) toast.success('Texto copiado!');
      else toast.error('Erro ao copiar');
    }
  };

  // --- Form Handlers ---
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMotivoPendenciaChange = async (value) => {
    setMotivoPendencia(value);
    if (fieldErrors.motivoPendencia) setFieldErrors(prev => ({ ...prev, motivoPendencia: false }));
    if (value === 'Em devolução' || value === 'Devolvido') {
      setStatusDevolucao(''); setDevolucaoRegistrada(false);
      if (formData.numero_pedido) setShowDevolucaoDialog(true);
    }
  };

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({ solicitacao: false, categoria: false, motivo: false, motivoPendencia: false, anotacoes: false });

    let hasError = false;
    const newErrors = { solicitacao: false, categoria: false, motivo: false, motivoPendencia: false, anotacoes: false };

    if (!formData.numero_pedido.trim()) { toast.error('Busque e selecione um pedido'); return; }
    if (!formData.solicitacao.trim()) { toast.error('Preencha o campo Solicitação'); newErrors.solicitacao = true; hasError = true; }
    if (!formData.categoria) { toast.error('Selecione a categoria'); newErrors.categoria = true; hasError = true; }
    if (!formData.motivo.trim()) { toast.error('Preencha o campo Motivo'); newErrors.motivo = true; hasError = true; }
    if (!formData.anotacoes.trim()) { toast.error('Adicione uma anotação antes de salvar'); newErrors.anotacoes = true; hasError = true; }

    if (isEditMode && formData.anotacoes.trim() === anotacoesOriginais.trim()) {
      if (!window.confirm('Você não adicionou uma nova anotação. Deseja continuar mesmo assim?')) return;
    }
    if (!isEditMode && encerrarAoCriar && !MOTIVOS_FINALIZADORES.includes(motivoPendencia)) {
      toast.error(`Para encerrar, selecione um motivo finalizador: ${MOTIVOS_FINALIZADORES.join(', ')}`); return;
    }
    if (hasError) { setFieldErrors(newErrors); return; }

    const isDevolucao = motivoPendencia === 'Em devolução' || motivoPendencia === 'Devolvido';
    if (isDevolucao && !statusDevolucao && !devolucaoRegistrada) {
      setPendingSubmitData({ formData, motivoPendencia, codigoReversa, dataVencimentoReversa, retornarChamado, verificarAdneia, encerrarAoCriar });
      setShowDevolucaoDialog(true); return;
    }
    await submitAtendimento(formData, motivoPendencia, codigoReversa, dataVencimentoReversa, retornarChamado, verificarAdneia, encerrarAoCriar, statusDevolucao);
  };

  const submitAtendimento = async (fd, mp, cr, dvr, rc, va, eac, sdp) => {
    setLoading(true);
    try {
      const payload = {
        ...fd, atendente: user?.name || fd.atendente,
        motivo_pendencia: mp || null, codigo_reversa: cr || null,
        data_vencimento_reversa: dvr || null, retornar_chamado: rc,
        verificar_adneia: va, status_devolucao: sdp || null,
        transportadora: pedidoErp?.transportadora || null
      };
      if (!isEditMode && eac) {
        payload.pendente = false;
        payload.data_fechamento = new Date().toISOString();
      }

      if (isEditMode && atendimentoId) {
        await axios.put(`${API_URL}/api/chamados/${atendimentoId}`, payload, { headers: getAuthHeader() });
        toast.success('Atendimento atualizado com sucesso!');
      } else {
        const response = await axios.post(`${API_URL}/api/chamados`, payload, { headers: getAuthHeader() });
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{response.data.id_atendimento} criado com sucesso!</span>
            <span className="text-xs opacity-80">Sincronizando com Google Sheets...</span>
          </div>
        );
      }
      navigate(filterParam ? `/chamados?filter=${filterParam}` : '/chamados');
    } catch (error) {
      toast.error(error.response?.data?.detail || `Erro ao ${isEditMode ? 'atualizar' : 'criar'} atendimento`);
    } finally { setLoading(false); }
  };

  const handleEncerrar = async () => {
    if (!isEditMode || !atendimentoId) return;
    setFieldErrors({ solicitacao: false, categoria: false, motivo: false, motivoPendencia: false, anotacoes: false });

    let hasError = false;
    const newErrors = { solicitacao: false, categoria: false, motivo: false, motivoPendencia: false, anotacoes: false };
    if (!formData.solicitacao.trim()) { newErrors.solicitacao = true; hasError = true; toast.error('Preencha o campo Solicitação antes de encerrar'); }
    if (!formData.categoria) { newErrors.categoria = true; hasError = true; toast.error('Selecione a categoria antes de encerrar'); }
    if (!formData.motivo.trim()) { newErrors.motivo = true; hasError = true; toast.error('Preencha o campo Motivo antes de encerrar'); }
    if (!motivoPendencia.trim()) { newErrors.motivoPendencia = true; hasError = true; toast.error('Preencha o Motivo da Pendência antes de encerrar'); }
    if (!formData.anotacoes.trim()) { newErrors.anotacoes = true; hasError = true; toast.error('Preencha as Anotações antes de encerrar'); }
    if (!MOTIVOS_FINALIZADORES.includes(motivoPendencia)) {
      toast.error(`O motivo "${motivoPendencia}" não permite encerrar o atendimento. Use: Entregue, Estornado, Atendido ou Em devolução.`);
      newErrors.motivoPendencia = true; hasError = true;
    }
    if (hasError) { setFieldErrors(newErrors); return; }

    const hoje = new Date().toLocaleDateString('pt-BR');
    const novasAnotacoes = formData.anotacoes
      ? `[${hoje}] *** ATENDIMENTO ENCERRADO ***\n\n${formData.anotacoes}`
      : `[${hoje}] *** ATENDIMENTO ENCERRADO ***`;

    setLoading(true);
    try {
      await axios.put(`${API_URL}/api/chamados/${atendimentoId}`, {
        ...formData,
        motivo_pendencia: motivoPendencia,
        status_cliente: motivoPendencia,
        status_atendimento: 'Fechado',
        pendente: false, retornar_chamado: false, verificar_adneia: false, anotacoes: novasAnotacoes
      }, { headers: getAuthHeader() });
      toast.success('Atendimento encerrado com sucesso!');
      navigate('/chamados');
    } catch { toast.error('Erro ao encerrar atendimento'); }
    finally { setLoading(false); }
  };

  // --- Devolução ---
  const handleReabrir = async () => {
    if (!isEditMode || !atendimentoId) return;
    if (!window.confirm('Deseja reabrir este atendimento?')) return;
    setLoading(true);
    try {
      await axios.put(`${API_URL}/api/chamados/${atendimentoId}/reabrir`, {}, { headers: getAuthHeader() });
      toast.success('Atendimento reaberto com sucesso!');
      loadAtendimento(atendimentoId);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao reabrir atendimento');
    } finally { setLoading(false); }
  };

  const handleExcluir = async () => {
    if (!isEditMode || !atendimentoId) return;
    if (!window.confirm('Tem certeza que deseja EXCLUIR este atendimento? Esta ação não pode ser desfeita.')) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/api/chamados/${atendimentoId}`, { headers: getAuthHeader() });
      toast.success('Atendimento excluído com sucesso!');
      navigate('/chamados');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao excluir atendimento');
    } finally { setLoading(false); }
  };

  const handleRegistrarDevolucaoComStatus = async (status) => {
    setShowDevolucaoDialog(false);
    setLoading(true);
    try {
      let devolvidoPor = '';
      if (codigoReversa) {
        devolvidoPor = 'Correios';
      } else {
        const transportadora = pedidoErp?.transportadora || atendimentoOriginal?.transportadora || '';
        if (transportadora) {
          const t = transportadora.toLowerCase();
          if (t.includes('total') || t.includes('tex')) devolvidoPor = 'Total Express';
          else if (t.includes('j&t') || t.includes('jt') || t.includes('j t') || t.includes('j e t')) devolvidoPor = 'J&T';
          else if (t.includes('cb') || t.includes('cb log')) devolvidoPor = 'CB';
          else if (t.includes('asap') || t.includes('logistica e solucoes') || t.includes('logística e soluções')) devolvidoPor = 'ASAP Log';
          else devolvidoPor = transportadora;
        } else { devolvidoPor = 'Transportadora'; }
      }

      const response = await axios.post(`${API_URL}/api/devolucoes`, {
        numero_pedido: formData.numero_pedido,
        nome_cliente: pedidoErp?.nome_cliente || '', cpf_cliente: pedidoErp?.cpf_cliente || '',
        solicitacao: formData.solicitacao || '', canal_vendas: formData.parceiro || pedidoErp?.canal_vendas || '',
        motivo: formData.motivo || '', codigo_reversa: codigoReversa || '',
        chamado_id: atendimentoId || '', id_atendimento: atendimentoOriginal?.id_atendimento || '',
        produto: pedidoErp?.produto || '', filial: pedidoErp?.uf_galpao || '',
        atendimento: status, devolvido_por: devolvidoPor, status_galpao: 'AGUARDANDO'
      }, { headers: getAuthHeader() });

      if (response.data.sync_status === 'success') {
        toast.success(`Devolução registrada! Status: ${status}, Devolvido por: ${devolvidoPor}`);
        setStatusDevolucao(status); setDevolucaoRegistrada(true);
      } else { toast.error('Falha ao registrar na planilha'); }
    } catch (error) {
      toast.error('Erro ao registrar devolução na planilha');
      console.error('Erro ao registrar devolução:', error);
    } finally { setLoading(false); }
  };

  const getStatusBadgeColor = (status) => {
    if (!status) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    const s = status.toLowerCase();
    if (s.includes('entreg')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400';
    if (s.includes('trânsito') || s.includes('transito')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400';
    if (s.includes('aguardando') || s.includes('pendente')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  };

  // --- Render ---
  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="novo-atendimento-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">
          {isEditMode ? 'Editar Atendimento' : 'Novo Atendimento'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isEditMode
            ? `Atualize o atendimento ${atendimentoOriginal?.id_atendimento || ''}`
            : 'Registre um novo atendimento no sistema ELO'
          }
        </p>
      </div>

      {loadingAtendimento ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Carregando atendimento...</span>
          </CardContent>
        </Card>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Buscar Pedido */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><Search className="h-5 w-5" /> 1. Buscar Pedido</CardTitle>
            <CardDescription>Busque por Pedido, CPF, Nome, Entrega ou Galpão+Nota</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-40" data-testid="select-search-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pedido">Pedido</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                  <SelectItem value="galpao">Galpão + Nota</SelectItem>
                </SelectContent>
              </Select>
              {searchType === 'galpao' && (
                <Select value={selectedGalpao} onValueChange={setSelectedGalpao}>
                  <SelectTrigger className="w-24" data-testid="select-galpao"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SC">SC</SelectItem>
                    <SelectItem value="SP">SP</SelectItem>
                    <SelectItem value="ES">ES</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex-1 relative">
                <Input value={searchValue} onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={searchType === 'pedido' ? 'Digite o número do pedido' : searchType === 'cpf' ? 'Digite o CPF do cliente' : searchType === 'nome' ? 'Digite o nome do cliente' : searchType === 'galpao' ? 'Digite o número da Nota Fiscal' : 'Digite o número da Entrega'}
                  className="text-lg h-12 pr-12" data-testid="input-search" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {searchingPedido && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                  {!searchingPedido && pedidoErp && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                  {!searchingPedido && pedidoNotFound && <AlertCircle className="h-5 w-5 text-amber-500" />}
                </div>
              </div>
            </div>
            {pedidoNotFound && !modoFalhaIntegracao && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">Nenhum pedido encontrado. Verifique o número e tente novamente.</p>
                <Button type="button" variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-100" data-testid="btn-falha-integracao"
                  onClick={() => { setModoFalhaIntegracao(true); setFormData(prev => ({ ...prev, numero_pedido: searchValue, categoria: 'Falha de Integração', motivo: 'Pedido não localizado na base' })); setPedidoNotFound(false); }}>
                  <AlertCircle className="h-4 w-4 mr-2" /> Abrir Chamado de Falha de Integração
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modo Falha de Integração */}
        {modoFalhaIntegracao && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300"><AlertCircle className="h-5 w-5" /> Falha de Integração</CardTitle>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setModoFalhaIntegracao(false); setFormData(prev => ({ ...prev, categoria: '', motivo: '', numero_pedido: '' })); }}>Cancelar</Button>
              </div>
              <CardDescription className="text-amber-600 dark:text-amber-400">Pedido não encontrado na base. Preencha os dados manualmente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>CPF do Cliente <span className="text-red-500">*</span></Label>
                  <Input value={formData.numero_pedido} onChange={(e) => handleChange('numero_pedido', e.target.value)} placeholder="Digite o CPF do cliente" data-testid="input-numero-pedido-falha" />
                  <p className="text-xs text-amber-600 mt-1">* Este campo será usado como identificador do atendimento</p>
                </div>
                <div>
                  <Label>Solicitação <span className="text-red-500">*</span></Label>
                  <Input value={formData.solicitacao} onChange={(e) => handleChange('solicitacao', e.target.value)} placeholder="Número da solicitação" className={fieldErrors.solicitacao ? 'border-red-500' : ''} data-testid="input-solicitacao-falha" />
                </div>
              </div>
              <div>
                <Label>Parceiro/Canal <span className="text-red-500">*</span></Label>
                <Input value={formData.parceiro} onChange={(e) => handleChange('parceiro', e.target.value)} placeholder="Digite o parceiro ou canal de venda" data-testid="input-parceiro-falha" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dados do Pedido */}
        {pedidoErp && (
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20" data-testid="pedido-info">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5 text-emerald-600" /> Pedido #{pedidoErp.numero_pedido}</CardTitle>
                  {pedidoErp.nome_cliente && <p className="text-sm text-muted-foreground mt-0.5">{pedidoErp.nome_cliente}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={getStatusBadgeColor(pedidoErp.status_pedido)}>{pedidoErp.status_pedido || 'Sem status'}</Badge>
                    {pedidoErp.data_status && <span className="text-xs text-muted-foreground">Últ. Ponto: {pedidoErp.data_status}</span>}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPedidoExpanded(!pedidoExpanded)} className="h-8 w-8 p-0" data-testid="expand-pedido-btn">
                    {pedidoExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {pedidoExpanded && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2"><User className="h-4 w-4" /> Cliente</h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium flex items-center gap-1 cursor-pointer hover:text-primary" onClick={() => copyToClipboard(pedidoErp.nome_cliente || '')} title="Copiar nome">
                      {pedidoErp.nome_cliente || '-'} <Copy className="h-3 w-3 text-muted-foreground" />
                    </p>
                    {pedidoErp.cpf_cliente && (
                      <p className="text-muted-foreground cursor-pointer hover:text-primary flex items-center gap-1" onClick={() => copyToClipboard(pedidoErp.cpf_cliente)} title="Copiar CPF">
                        CPF: {pedidoErp.cpf_cliente} <Copy className="h-3 w-3 text-muted-foreground" />
                      </p>
                    )}
                    {(() => {
                      const email = pedidoErp.email_cliente || 'atendimento@weconnect360.com.br';
                      return (
                        <p className="text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-primary" onClick={() => copyToClipboard(email)} title="Copiar e-mail">
                          <Mail className="h-3 w-3" /> {email} <Copy className="h-3 w-3 text-muted-foreground" />
                        </p>
                      );
                    })()}
                    {pedidoErp.fone_cliente && (
                      <p className="text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-primary" onClick={() => copyToClipboard(pedidoErp.fone_cliente)} title="Copiar telefone">
                        <Phone className="h-3 w-3" /> {pedidoErp.fone_cliente} <Copy className="h-3 w-3 text-muted-foreground" />
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Endereço</h4>
                  <div className="pl-6 space-y-1 text-sm">
                    {pedidoErp.cidade && pedidoErp.uf ? <p className="font-medium">{pedidoErp.cidade} - {pedidoErp.uf}</p> : <p className="text-muted-foreground">-</p>}
                    {pedidoErp.cep && (
                      <p className="text-muted-foreground cursor-pointer hover:text-primary flex items-center gap-1" onClick={() => copyToClipboard(String(pedidoErp.cep).padStart(8, '0'))} title="Copiar CEP">
                        CEP: {String(pedidoErp.cep).padStart(8, '0')} <Copy className="h-3 w-3 text-muted-foreground" />
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Produto</h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium cursor-pointer hover:text-primary flex items-center gap-1" onClick={() => copyToClipboard(pedidoErp.produto || '')} title="Copiar produto">
                      {pedidoErp.produto || '-'} <Copy className="h-3 w-3 text-muted-foreground" />
                    </p>
                    {pedidoErp.departamento && <p className="text-muted-foreground">Marca: {pedidoErp.departamento}</p>}
                    {pedidoErp.codigo_item_bseller && <p className="text-muted-foreground">ID: {pedidoErp.codigo_item_bseller}</p>}
                    {pedidoErp.codigo_item_vtex && <p className="text-muted-foreground">SKU: {pedidoErp.codigo_item_vtex}</p>}
                    {pedidoErp.codigo_fornecedor && <p className="text-muted-foreground">Cód. Fornecedor: {pedidoErp.codigo_fornecedor}</p>}
                    {pedidoErp.quantidade && <p className="text-muted-foreground">Qtde: {pedidoErp.quantidade}</p>}
                    {(pedidoErp.estoque_disponivel !== undefined && pedidoErp.estoque_disponivel !== null) && (
                      <p className={`font-medium ${Number(pedidoErp.estoque_disponivel) > 0 ? 'text-green-600' : 'text-red-600'}`}>Estoque Disp.: {pedidoErp.estoque_disponivel}</p>
                    )}
                    {pedidoErp.preco_final && (
                      <p className="text-muted-foreground cursor-pointer hover:text-primary flex items-center gap-1" onClick={() => copyToClipboard(parseFloat(pedidoErp.preco_final).toFixed(2))} title="Copiar valor">
                        Valor: R$ {parseFloat(pedidoErp.preco_final).toFixed(2)} <Copy className="h-3 w-3 text-muted-foreground" />
                      </p>
                    )}
                    {pedidoErp.cmv && (
                      <p className="text-red-600 dark:text-red-400 font-medium">
                        Preço de Custo: R$ {parseFloat(pedidoErp.cmv).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Entrega</h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.transportadora || '-'}</p>
                    {pedidoErp.canal_vendas && <p className="text-muted-foreground">Canal: {pedidoErp.canal_vendas}</p>}
                    {pedidoErp.data_status && <p className="text-muted-foreground">Atualização: {pedidoErp.data_status}</p>}
                  </div>
                </div>
              </div>
              {pedidoErp.nota_fiscal && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Nota Fiscal</h4>
                    <div className="pl-6 space-y-1 text-sm">
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <p><span className="text-muted-foreground">NF:</span> {String(pedidoErp.nota_fiscal).split('.')[0]}</p>
                        {pedidoErp.uf_galpao && pedidoErp.uf_galpao !== '-' && <p><span className="text-muted-foreground">Galpão:</span> <span className="font-medium">{pedidoErp.uf_galpao}</span></p>}
                      </div>
                      {pedidoErp.chave_nota && <p className="text-xs text-muted-foreground break-all">Chave: {pedidoErp.chave_nota}</p>}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            )}
          </Card>
        )}

        {/* Dados do Atendimento (edit mode sem pedido ERP) */}
        {!pedidoErp && isEditMode && atendimentoOriginal && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20" data-testid="atendimento-info">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5 text-amber-600" /> Atendimento #{atendimentoOriginal.id_atendimento || formData.numero_pedido}</CardTitle>
              <CardDescription className="text-xs text-amber-600">Pedido não encontrado na base ERP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {atendimentoOriginal.numero_pedido && <div><span className="text-muted-foreground">Entrega:</span><p className="font-medium">{atendimentoOriginal.numero_pedido}</p></div>}
                {atendimentoOriginal.nome_cliente && <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{atendimentoOriginal.nome_cliente}</p></div>}
                {atendimentoOriginal.parceiro && <div><span className="text-muted-foreground">Parceiro:</span><p className="font-medium">{atendimentoOriginal.parceiro}</p></div>}
                {atendimentoOriginal.categoria && <div><span className="text-muted-foreground">Categoria:</span><p className="font-medium">{atendimentoOriginal.categoria}</p></div>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 2. Classificação + Textos + Anotações + Ações */}
        {(pedidoErp || modoFalhaIntegracao || isEditMode) && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5" /> 2. Classificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className={fieldErrors.solicitacao ? 'text-red-600' : ''}>Solicitação (Parceiro) <span className="text-red-500">*</span></Label>
                    <Input value={formData.solicitacao} onChange={(e) => { handleChange('solicitacao', e.target.value); if (fieldErrors.solicitacao) setFieldErrors(prev => ({ ...prev, solicitacao: false })); }}
                      placeholder="Nº da solicitação" data-testid="input-solicitacao" className={fieldErrors.solicitacao ? 'border-red-500 focus:ring-red-500' : ''} />
                  </div>


                  <div>
                    <Label>Parceiro/Canal</Label>
                    <Input value={formData.parceiro} onChange={(e) => handleChange('parceiro', e.target.value)} placeholder="Ex: CSU, Livelo" data-testid="input-parceiro" />
                  </div>
                  <div>
                    <Label>Atendente (última revisão)</Label>
                    <Input value={user?.name || formData.atendente || ''} readOnly className="bg-muted cursor-not-allowed" data-testid="input-atendente" />
                    <p className="text-xs text-muted-foreground mt-1">Atualizado automaticamente ao salvar</p>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label className={fieldErrors.categoria ? 'text-red-600' : ''}>Categoria <span className="text-red-500">*</span></Label>
                    {isEditMode && formData.categoria_inicial && (
                      <p className="text-xs text-amber-600 mb-1">Categoria inicial: <strong>{formData.categoria_inicial}</strong>{formData.categoria !== formData.categoria_inicial && ' (alterada)'}</p>
                    )}
                    <Select value={formData.categoria} onValueChange={(v) => { handleChange('categoria', v); if (fieldErrors.categoria) setFieldErrors(prev => ({ ...prev, categoria: false })); }}>
                      <SelectTrigger data-testid="select-categoria" className={fieldErrors.categoria ? 'border-red-500 focus:ring-red-500' : ''}><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                      <SelectContent>{CATEGORIAS.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label className={fieldErrors.motivo ? 'text-red-600' : ''}>Motivo <span className="text-red-500">*</span></Label>
                    <Input value={formData.motivo} onChange={(e) => { handleChange('motivo', e.target.value); if (fieldErrors.motivo) setFieldErrors(prev => ({ ...prev, motivo: false })); }}
                      placeholder="Motivo específico do atendimento" data-testid="input-motivo" className={fieldErrors.motivo ? 'border-red-500 focus:ring-red-500' : ''} />
                  </div>
                </div>

                {/* Textos Reclame Aqui */}
                {isReclameAqui() && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Respostas Padrão - Reclame Aqui</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(TEXTOS_RECLAME_AQUI).map(tipo => (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => loadTextoReclameAqui(tipo)}
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            selectedReclameAqui === tipo
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white dark:bg-slate-800 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30'
                          }`}
                        >
                          {tipo}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

            {/* 3. Anotações */}
            <SecaoAnotacoes
              formData={formData}
              onChangeField={handleChange}
              isEditMode={isEditMode}
              fieldErrors={fieldErrors}
              onFieldErrorClear={(field) => setFieldErrors(prev => ({ ...prev, [field]: false }))}
              motivoPendencia={motivoPendencia}
              onMotivoPendenciaChange={handleMotivoPendenciaChange}
              codigoReversa={codigoReversa}
              onCodigoReversaChange={setCodigoReversa}
              dataVencimentoReversa={dataVencimentoReversa}
              onDataVencimentoReversaChange={setDataVencimentoReversa}
              retornarChamado={retornarChamado}
              onRetornarChamadoChange={setRetornarChamado}
              verificarAdneia={verificarAdneia}
              onVerificarAdneiaChange={setVerificarAdneia}
              pedidoErp={pedidoErp}
              selectedMotivoPendencia={selectedMotivoPendencia}
              selectedAssistenciaAguardando={selectedAssistenciaAguardando}
              onLoadTextoMotivoPendencia={loadTextoMotivoPendencia}
              onLoadTextoPadrao={loadTextoPadrao}
              onLoadTextoReversaAssistencia={loadTextoReversaAssistencia}
              onLoadTextoFalhaFornecedor={loadTextoFalhaFornecedor}
              onLoadTextoComprovante={loadTextoComprovante}
              onLoadTextoFalhaTransporte={loadTextoFalhaTransporte}
              parceiro={formData.parceiro}
              onLoadTextoRaw={handleLoadTextoRaw}
            />

            {/* Ações */}
            <AcoesFormulario
              isEditMode={isEditMode}
              loading={loading}
              encerrarAoCriar={encerrarAoCriar}
              onEncerrarAoCriarChange={setEncerrarAoCriar}
              motivoPendencia={motivoPendencia}
              pendente={formData.pendente}
              onEncerrar={handleEncerrar}
              onReabrir={handleReabrir}
              onExcluir={handleExcluir}
              onCancel={() => navigate(filterParam ? `/chamados?filter=${filterParam}` : '/chamados')}
            />
          </>
        )}
      </form>
      )}

      {/* Dialog: Atendimento Existente */}
      <Dialog open={showExistingDialog} onOpenChange={setShowExistingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-600">Atendimento Existente</DialogTitle>
            <DialogDescription>Já existe um atendimento para esta entrega</DialogDescription>
          </DialogHeader>
          {existingAtendimento && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="font-medium">Solicitação: {existingAtendimento.solicitacao || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">Entrega: {existingAtendimento.numero_pedido}</p>
              <p className="text-sm text-muted-foreground">Categoria: {existingAtendimento.categoria}</p>
              <p className="text-sm text-muted-foreground">Status: {existingAtendimento.pendente ? 'Pendente' : 'Resolvido'}</p>
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => { setShowExistingDialog(false); if (existingAtendimento) navigate(`/chamados/editar/${existingAtendimento.id}`); }}>Abrir Atendimento Existente</Button>
            <Button onClick={() => setShowExistingDialog(false)}>Abrir Novo Atendimento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Lista de Pedidos */}
      <Dialog open={showPedidosDialog} onOpenChange={setShowPedidosDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecione o Pedido</DialogTitle>
            <DialogDescription>Foram encontrados {pedidosList.length} pedidos para este CPF</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {pedidosList.map(pedido => (
              <div key={pedido.numero_pedido} className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors" onClick={() => selectPedido(pedido)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Entrega #{pedido.numero_pedido}</p>
                    <p className="text-sm text-muted-foreground">{pedido.produto}</p>
                    <p className="text-xs text-muted-foreground">{pedido.data_status}</p>
                  </div>
                  <Badge className={getStatusBadgeColor(pedido.status_pedido)}>{pedido.status_pedido}</Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Texto Padrão */}
      <Dialog open={showTextoDialog} onOpenChange={setShowTextoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Texto Padrão - {formData.categoria}</DialogTitle></DialogHeader>
          <div className="relative">
            <Textarea ref={textoAreaRef} value={textoPadrao} readOnly rows={12} className="font-mono text-sm" />
            <Button type="button" variant="outline" size="sm" className="absolute top-2 right-2" onClick={() => {
              if (textoAreaRef.current) {
                textoAreaRef.current.focus();
                textoAreaRef.current.select();
                const ok = document.execCommand('copy');
                if (ok) toast.success('Texto copiado!');
                else copyToClipboard(textoPadrao);
              } else {
                copyToClipboard(textoPadrao);
              }
            }}>
              <Copy className="h-4 w-4 mr-2" /> Copiar
            </Button>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setShowTextoDialog(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Devolução */}
      <Dialog open={showDevolucaoDialog} onOpenChange={setShowDevolucaoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-amber-500" /> Registrar Devolução</DialogTitle>
            <DialogDescription>O atendimento será registrado na planilha <strong>Gestão Devoluções 2026_E</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Pedido:</strong> #{formData.numero_pedido}</p>
              <p><strong>Cliente:</strong> {pedidoErp?.nome_cliente || '-'}</p>
              <p><strong>Motivo:</strong> {formData.motivo || '-'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Selecione o status do pedido:</p>
              <div className="flex flex-col gap-2">
                {[
                  { status: 'Aguardando', desc: 'Aguardando retorno do produto', hoverClass: 'hover:bg-amber-50 hover:border-amber-300' },
                  { status: 'Estornado', desc: 'Valor já foi estornado', hoverClass: 'hover:bg-green-50 hover:border-green-300' },
                  { status: 'Reenviado', desc: 'Novo produto foi enviado', hoverClass: 'hover:bg-blue-50 hover:border-blue-300' },
                ].map(({ status, desc, hoverClass }) => (
                  <Button key={status} variant="outline" className={`w-full justify-start text-left h-auto py-3 ${hoverClass}`}
                    onClick={() => handleRegistrarDevolucaoComStatus(status)} disabled={loading}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{status}</span>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2">
              <p><strong>Devolvido por:</strong> {codigoReversa ? 'Correios (tem reversa)' : 'Transportadora (sem reversa)'}</p>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setShowDevolucaoDialog(false)} disabled={loading}>Cancelar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NovoAtendimento;
