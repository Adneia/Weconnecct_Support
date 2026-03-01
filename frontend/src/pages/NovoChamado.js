import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Search, Package, Truck, User, MapPin, 
  Phone, Mail, Calendar, ShoppingBag, Copy,
  FileText, Hash, Building, AlertCircle, CheckCircle,
  MessageSquare, RotateCcw, Warehouse
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIAS = [
  "Falha Produção",
  "Falha de Compras", 
  "Falha Transporte",
  "Produto com Avaria",
  "Divergência de Produto",
  "Arrependimento",
  "Dúvida",
  "Reclamação",
  "Assistência Técnica"
];

const ATENDENTES = ["Letícia Martelo", "Adnéia Campos"];

// Motivos de pendência
const MOTIVOS_PENDENCIA = [
  "Ag. Compras",
  "Ag. Logística", 
  "Enviado",
  "Ag. Bseller",
  "Ag. Barrar",
  "Aguardando",
  "Em devolução"
];

// Função para detectar categoria e motivo baseado no status do pedido
const getCategoriaPorStatus = (statusPedido) => {
  if (!statusPedido) return { categoria: '', motivo: '' };
  
  const status = statusPedido.toLowerCase();
  
  // Aguardando estoque
  if (status.includes('aguardando estoque') || status.includes('ag. estoque')) {
    return { categoria: 'Falha de Compras', motivo: 'Ag. Compras' };
  }
  
  // NF emitida, NF Aprovada, Entregue à transportadora
  if (status.includes('nf emitida') || status.includes('nf aprovada') || 
      status.includes('entregue à transportadora') || status.includes('entregue a transportadora')) {
    return { categoria: 'Falha Produção', motivo: 'Ag. Logística' };
  }
  
  // Pedido Entregue - deixar em aberto
  if (status.includes('entregue') && !status.includes('transportadora')) {
    return { categoria: '', motivo: '' }; // Deixar aberto para seleção
  }
  
  // Em trânsito, saiu para entrega, etc (depois de entregue à transportadora)
  if (status.includes('trânsito') || status.includes('transito') || 
      status.includes('saiu para entrega') || status.includes('em rota') ||
      status.includes('tentativa') || status.includes('aguardando retirada')) {
    return { categoria: 'Falha Transporte', motivo: 'Enviado' };
  }
  
  return { categoria: '', motivo: '' };
};

// Função para detectar transportadora e retornar tipo de rastreio
const getTransportadoraRastreio = (transportadora) => {
  if (!transportadora) return null;
  
  const transp = transportadora.toLowerCase();
  
  if (transp.includes('total') || transp.includes('tex')) {
    return 'Com Rastreio - Total Express';
  }
  if (transp.includes('j&t') || transp.includes('jt') || transp.includes('j t')) {
    return 'Com Rastreio - J&T Express';
  }
  if (transp.includes('asap') || transp.includes('logistica e solucoes') || transp.includes('logística e soluções')) {
    return 'Com Rastreio - ASAP Log';
  }
  
  return null;
};

// Textos de Avaria organizados
const TEXTOS_AVARIA = {
  "Avaria - Necessário Evidência": `Olá, Boa tarde.

Para darmos continuidade à tratativa, solicitamos, por gentileza, o envio das seguintes evidências:

* Imagem da embalagem recebida;
* Foto da etiqueta entregue.
* Foto do produto (todos os ângulos)
* Foto ou vídeo que identifique a avaria

Ressaltamos que o prazo para acionar a transportadora é de 7 dias corridos após a entrega do produto avariado.

Estamos à disposição para quaisquer dúvidas e aguardamos seu retorno.
Atenciosamente,
[ASSINATURA]`,

  "Avaria - Transporte até R$250": `Olá, Boa tarde.

Informamos que iniciamos a preparação e o envio de um novo produto para o cliente.

Em caráter de exceção, não será necessário realizar a devolução do item avariado. Pedimos, por gentileza, que oriente o cliente quanto ao descarte adequado do produto.

Assim que possível, compartilharemos o link de rastreamento.

Permanecemos à disposição para qualquer dúvida.
Atenciosamente,
[ASSINATURA]`,

  "Avaria - Reversa": `Olá, Boa tarde.

Sentimos muito pelo ocorrido, poderia confirmar com o cliente se após a devolução seguiremos com reenvio ou cancelamento?

Referente a solicitação, segue os dados para realizar o retorno do produto em no máximo 10 dias.

Autorização de Postagem em Agência

Dados da Emissão:

Objeto: 
Emitido em: [DATA_EMISSAO]
Data de Validade: [DATA_VALIDADE]
Remetente autorizado: [NOME_CLIENTE]

- Para utilizá-la, o consumidor dever se dirigir a uma Agência Própria ou Franqueada dos Correios, levando consigo, obrigatoriamente, o Código de Autorização e o objeto para postagem.

DESTINATÁRIO:
WECONNECT COMERCIO E SERVICOS LTDA 


*** Orientações importantes ***: 

* O produto deve ser devolvido na embalagem original e sem avaria (dentro de uma outra caixa de papelão OU papel pardo para manter a integridade do produto); 

* Sem indícios de uso, sem violação do lacre original do fabricante; 

* Coloque a nota fiscal dentro de um envelope plástico adesivo e cole-o na parte externa do pacote. Este tipo de envelope deve estar disponível em qualquer agência dos Correios; 

* Acompanhado também dos acessórios/peças e manual do item. 

* O estorno somente será autorizado após as avaliações citadas acima. As informações do destinatário serão preenchidas na agência dos Correios de acordo com Código de Postagem. 

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`
};

// Textos de Falha Produção
const TEXTOS_FALHA_PRODUCAO = {
  "Sem Rastreio": `Olá, Boa tarde.

Identificamos uma falha operacional, a qual, está sendo resolvida. O pedido encontra-se em separação para transportadora. Assim que possível, disponibilizaremos o link para rastreio e previsão de entrega.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]`,

  "Com Rastreio - Total Express": `Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]

https://totalconecta.totalexpress.com.br/rastreamento

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Com Rastreio - J&T Express": `Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]

https://www.jtexpress.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Com Rastreio - ASAP Log": `Olá, Boa tarde.

Informamos que o pedido já foi entregue à transportadora. Pedimos, por gentileza, que aguarde o prazo de até 48 horas úteis para que as informações de rastreamento e a previsão de entrega sejam atualizadas no sistema.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]

https://rastreio.asaplog.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`
};

// Textos de Falha Transporte
const TEXTOS_FALHA_TRANSPORTE = {
  "Rastreio - Total Express": `Olá, Boa tarde.

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

https://totalconecta.totalexpress.com.br/rastreamento

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Rastreio - J&T Express": `Olá, Boa tarde.

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue rastreio para acompanhamento:
Chave de acesso: [CHAVE_ACESSO]
Previsão de entrega até dia [DATA_PREVISAO]

https://www.jtexpress.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Rastreio - ASAP Log": `Olá, Boa tarde.

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Acionado transportadora para seguir com a entrega com prioridade.

Segue rastreio para acompanhamento:
Nota Fiscal: [NOTA_FISCAL]
Previsão de entrega até dia [DATA_PREVISAO]

https://rastreio.asaplog.com.br/

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Rastreio - Correios": `Olá, Boa tarde.

Pedido em processo de entrega, podendo ser entregue a qualquer momento.

Segue link para rastreio:
https://rastreamento.correios.com.br/app/index.php
Rastreio: [CÓDIGO_RASTREIO]
Previsão de entrega até dia [DATA_PREVISAO]

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Bloqueio da Entrega": `Olá, Boa tarde.

Acionamos a transportadora com o bloqueio de entrega. Poderia, por favor orientar o cliente que em caso de tentativa de entrega, recusar o recebimento.

Assim que entrar em devolução, entraremos em contato.

Seguimos a disposição.
Atenciosamente!
[ASSINATURA]`,

  "Não é Possível Bloqueio": `Olá, Boa tarde.

Acionamos a transportadora com a solicitação de bloqueio da entrega. No entanto, identificamos que o pedido encontra-se em rota de entrega, o que significa que pode não ser possível impedir a entrega a tempo.

Por gentileza, oriente o cliente a recusar o recebimento, caso a tentativa de entrega ocorra.

Caso a entrega seja concluída, nos acionar novamente para que possamos seguir com a emissão da reversa para devolução do pedido.

Assim que o pedido retornar ao nosso centro de distribuição, entraremos em contato.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Extravio": `Olá, Boa tarde.

O pedido foi extraviado pela transportadora. Iniciamos a preparação para envio de um novo item ao cliente, assim que possível disponibilizaremos o link para rastreio.
Pedimos a gentileza de solicitar ao cliente que em caso de entrega nos acione para darmos as devidas tratativas.

Seguimos a disposição.
Atenciosamente,
[ASSINATURA]`,

  "Extravio com Previsão": `Olá, Boa tarde.

O pedido foi extraviado pela transportadora, iniciamos uma nova preparação para envio ao cliente. A previsão atual de entrega é para o dia [DATA_PREVISAO]. Poderia, por gentileza, confirmar junto ao cliente a nova previsão?

Pedimos a gentileza de solicitar ao cliente que em caso de entrega nos acione para darmos as devidas tratativas.

Atenciosamente,
[ASSINATURA]`,

  "Extravio com Cancelamento": `Olá, Bom dia.

Informamos que o item [PRODUTO] ([ENTREGA]) foi extraviado pela transportadora. Pedimos a gentileza de seguir com o cancelamento e estorno devido a indisponibilidade de reposição.

Pedimos sinceras desculpas pelo ocorrido.

Atenciosamente,
[ASSINATURA]`,

  "Falta Comprovante": `Olá, Boa tarde.

Solicitamos o comprovante de entrega assinado ou o início do processo de acareação da entrega. Assim que possível, encaminharemos as informações.

Pedimos, por gentileza, que, ao entrar em contato com a cliente, seja solicitado que nos informe caso o pedido seja entregue.

Seguimos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Desconhece Entrega - No Prazo": `Olá, Boa tarde.

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Por favor confirmar entrega junto ao cliente.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Podemos encerrar o atendimento?

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "Desconhece Entrega - Fora Prazo": `Olá, Boa tarde.

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Encaminhamos em anexo o comprovante de entrega para sua conferência.

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados a partir da data da entrega. Dessa forma, informamos que o prazo para solicitação de acareação já se encontra expirado.

Diante disso, prosseguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`,

  "CSU - Comprovante Email": `Olá, Boa tarde.

Informamos que o pedido foi entregue em [DATA_ENTREGA]. Por favor confirmar entrega junto ao cliente e seguir com o encerramento do chamado. Comprovante enviado via e-mail.

Assunto: Ocorrência: [NUMERO_OCORRENCIA]

Ressaltamos que o prazo para contestação da entrega ou solicitação de acareação é de até 10 dias corridos, contados da data da entrega. Caso haja qualquer divergência, pedimos que nos informe dentro desse período para que possamos realizar as devidas análises.

Na ausência de manifestação dentro do prazo informado, seguiremos com o encerramento do chamado.

Permanecemos à disposição.
Atenciosamente,
[ASSINATURA]`
};

const NovoAtendimento = () => {
  const [loading, setLoading] = useState(false);
  const [searchingPedido, setSearchingPedido] = useState(false);
  const [pedidoNotFound, setPedidoNotFound] = useState(false);
  const [pedidoErp, setPedidoErp] = useState(null);
  const [pedidosList, setPedidosList] = useState([]);
  const [showPedidosDialog, setShowPedidosDialog] = useState(false);
  const [showTextoDialog, setShowTextoDialog] = useState(false);
  const [textoPadrao, setTextoPadrao] = useState('');
  const [codigoReversa, setCodigoReversa] = useState('');
  
  const [searchType, setSearchType] = useState('cpf'); // 'cpf', 'pedido', 'nome', 'entrega'
  const [searchValue, setSearchValue] = useState('');
  const [selectedAvaria, setSelectedAvaria] = useState('');
  const [selectedFalhaProducao, setSelectedFalhaProducao] = useState('');
  const [motivoPendencia, setMotivoPendencia] = useState('');
  const [transportadoraDetectada, setTransportadoraDetectada] = useState(null);
  
  const [formData, setFormData] = useState({
    numero_pedido: '',
    solicitacao: '',
    parceiro: '',
    categoria: '',
    motivo: '',
    anotacoes: '',
    atendente: 'Letícia Martelo'
  });

  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();

  // Busca automática com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue.trim().length >= 3) {
        if (searchType === 'entrega') {
          searchByEntrega(searchValue.trim());
        } else if (searchType === 'cpf') {
          searchByCpf(searchValue.trim());
        } else if (searchType === 'nome') {
          searchByNome(searchValue.trim());
        } else if (searchType === 'pedido') {
          searchByPedido(searchValue.trim());
        }
      } else {
        setPedidoErp(null);
        setPedidosList([]);
        setPedidoNotFound(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue, searchType]);

  // Função para processar pedido e auto-preencher campos
  const processarPedido = (pedido) => {
    setPedidoErp(pedido);
    
    // Auto-detectar categoria e motivo baseado no status
    const { categoria, motivo } = getCategoriaPorStatus(pedido.status_pedido);
    
    // Auto-detectar transportadora
    const transpRastreio = getTransportadoraRastreio(pedido.transportadora);
    setTransportadoraDetectada(transpRastreio);
    
    // Atualizar formulário
    setFormData(prev => ({ 
      ...prev, 
      numero_pedido: pedido.numero_pedido,
      parceiro: pedido.canal_vendas || '',
      categoria: categoria || prev.categoria
    }));
    
    // Atualizar motivo de pendência
    if (motivo) {
      setMotivoPendencia(motivo);
    }
    
    // Se detectou transportadora e categoria é Falha Produção, auto-selecionar
    if (transpRastreio && categoria === 'Falha Produção') {
      setSelectedFalhaProducao(transpRastreio);
    }
  };

  const searchByEntrega = async (entrega) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/${entrega}`,
        { headers: getAuthHeader() }
      );
      processarPedido(response.data);
      setPedidoNotFound(false);
    } catch (error) {
      if (error.response?.status === 404) {
        setPedidoNotFound(true);
      } else {
        toast.error('Erro ao buscar pedido');
      }
    } finally {
      setSearchingPedido(false);
    }
  };

  const searchByCpf = async (cpf) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidosList([]);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/buscar/cpf/${cpf}`,
        { headers: getAuthHeader() }
      );
      
      if (response.data.length === 0) {
        setPedidoNotFound(true);
      } else if (response.data.length === 1) {
        processarPedido(response.data[0]);
      } else {
        setPedidosList(response.data);
        setShowPedidosDialog(true);
      }
    } catch (error) {
      toast.error('Erro ao buscar por CPF');
    } finally {
      setSearchingPedido(false);
    }
  };

  const searchByNome = async (nome) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidosList([]);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/buscar/nome/${encodeURIComponent(nome)}`,
        { headers: getAuthHeader() }
      );
      
      if (response.data.length === 0) {
        setPedidoNotFound(true);
      } else if (response.data.length === 1) {
        processarPedido(response.data[0]);
      } else {
        setPedidosList(response.data);
        setShowPedidosDialog(true);
      }
    } catch (error) {
      toast.error('Erro ao buscar por nome');
    } finally {
      setSearchingPedido(false);
    }
  };

  const searchByPedido = async (pedido) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidosList([]);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/buscar/pedido/${encodeURIComponent(pedido)}`,
        { headers: getAuthHeader() }
      );
      
      if (response.data.length === 0) {
        setPedidoNotFound(true);
      } else if (response.data.length === 1) {
        processarPedido(response.data[0]);
      } else {
        setPedidosList(response.data);
        setShowPedidosDialog(true);
      }
    } catch (error) {
      toast.error('Erro ao buscar por pedido');
    } finally {
      setSearchingPedido(false);
    }
  };

  const selectPedido = (pedido) => {
    processarPedido(pedido);
    setShowPedidosDialog(false);
  };

  const loadTextoPadrao = async (categoria) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/textos-padroes/${encodeURIComponent(categoria)}`,
        { headers: getAuthHeader() }
      );
      // Substituir [ASSINATURA] pelo nome do atendente selecionado
      let texto = response.data.texto;
      if (formData.atendente) {
        texto = texto.replace(/\[ASSINATURA\]/g, formData.atendente);
      }
      // Substituir [NOME_CLIENTE] pelo nome do cliente
      if (pedidoErp?.nome_cliente) {
        texto = texto.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
        texto = texto.replace(/\[NOME\]/g, pedidoErp.nome_cliente);
      }
      setTextoPadrao(texto);
      setShowTextoDialog(true);
    } catch (error) {
      toast.error('Erro ao carregar texto padrão');
    }
  };

  const loadTextoAvaria = (tipoAvaria) => {
    let texto = TEXTOS_AVARIA[tipoAvaria] || '';
    // Substituir placeholders
    if (formData.atendente) {
      texto = texto.replace(/\[ASSINATURA\]/g, formData.atendente);
    }
    if (pedidoErp?.nome_cliente) {
      texto = texto.replace(/\[NOME_CLIENTE\]/g, pedidoErp.nome_cliente);
    }
    setTextoPadrao(texto);
    setSelectedAvaria(tipoAvaria);
    setShowTextoDialog(true);
  };

  const loadTextoFalhaProducao = (tipoFalha) => {
    let texto = TEXTOS_FALHA_PRODUCAO[tipoFalha] || '';
    // Substituir placeholders
    if (formData.atendente) {
      texto = texto.replace(/\[ASSINATURA\]/g, formData.atendente);
    }
    if (pedidoErp?.nota_fiscal) {
      texto = texto.replace(/\[NOTA_FISCAL\]/g, pedidoErp.nota_fiscal);
    }
    if (pedidoErp?.chave_nota) {
      texto = texto.replace(/\[CHAVE_ACESSO\]/g, pedidoErp.chave_nota);
    }
    if (pedidoErp?.codigo_rastreio) {
      texto = texto.replace(/\[CÓDIGO_RASTREIO\]/g, pedidoErp.codigo_rastreio);
    }
    setTextoPadrao(texto);
    setSelectedFalhaProducao(tipoFalha);
    setShowTextoDialog(true);
  };

  const gerarCodigoReversa = async () => {
    if (!formData.numero_pedido) {
      toast.error('Selecione um pedido primeiro');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/api/gerar-reversa/${formData.numero_pedido}`,
        {},
        { headers: getAuthHeader() }
      );
      setCodigoReversa(response.data.codigo_reversa);
      toast.success(`Código gerado: ${response.data.codigo_reversa}`);
    } catch (error) {
      toast.error('Erro ao gerar código de reversa');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.numero_pedido.trim()) {
      toast.error('Busque e selecione um pedido');
      return;
    }
    if (!formData.categoria) {
      toast.error('Selecione a categoria');
      return;
    }

    setLoading(true);
    try {
      // Adicionar motivo da pendência nas anotações
      let anotacoesCompletas = formData.anotacoes || '';
      if (motivoPendencia) {
        const prefixo = anotacoesCompletas ? '\n\n' : '';
        anotacoesCompletas += `${prefixo}Motivo da pendência: ${motivoPendencia}`;
      }
      
      const payload = {
        ...formData,
        anotacoes: anotacoesCompletas,
        reversa_codigo: codigoReversa || null
      };
      
      const response = await axios.post(
        `${API_URL}/api/chamados`,
        payload,
        { headers: getAuthHeader() }
      );
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{response.data.id_atendimento} criado com sucesso!</span>
          <span className="text-xs opacity-80">Sincronizando com Google Sheets...</span>
        </div>
      );
      navigate(`/chamados/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar atendimento');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getStatusBadgeColor = (status) => {
    if (!status) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('entreg')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400';
    if (statusLower.includes('trânsito') || statusLower.includes('transito')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400';
    if (statusLower.includes('aguardando') || statusLower.includes('pendente')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="novo-atendimento-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Novo Atendimento</h1>
        <p className="text-muted-foreground text-sm">Registre um novo atendimento no sistema Emergent</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Buscar Pedido */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              1. Buscar Pedido
            </CardTitle>
            <CardDescription>Busque por CPF, Pedido, Nome ou Entrega</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-40" data-testid="select-search-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="pedido">Pedido</SelectItem>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex-1 relative">
                <Input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={
                    searchType === 'cpf' ? 'Digite o CPF do cliente' : 
                    searchType === 'pedido' ? 'Digite o número do pedido externo' : 
                    searchType === 'nome' ? 'Digite o nome do cliente' :
                    'Digite o número da Entrega'
                  }
                  className="text-lg h-12 pr-12"
                  data-testid="input-search"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {searchingPedido && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                  {!searchingPedido && pedidoErp && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                  {!searchingPedido && pedidoNotFound && <AlertCircle className="h-5 w-5 text-amber-500" />}
                </div>
              </div>
            </div>
            
            {pedidoNotFound && (
              <p className="text-sm text-amber-600">
                Nenhum pedido encontrado. Verifique o número e tente novamente.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dados do Pedido */}
        {pedidoErp && (
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20" data-testid="pedido-info">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-600" />
                  Pedido #{pedidoErp.numero_pedido}
                </CardTitle>
                <Badge className={getStatusBadgeColor(pedidoErp.status_pedido)}>
                  {pedidoErp.status_pedido || 'Sem status'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <User className="h-4 w-4" /> Cliente
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.nome_cliente || '-'}</p>
                    {pedidoErp.cpf_cliente && <p className="text-muted-foreground">CPF: {pedidoErp.cpf_cliente}</p>}
                    {pedidoErp.email_cliente && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {pedidoErp.email_cliente}
                      </p>
                    )}
                    {pedidoErp.fone_cliente && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {pedidoErp.fone_cliente}
                      </p>
                    )}
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Endereço
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    {pedidoErp.cidade && pedidoErp.uf ? (
                      <p className="font-medium">{pedidoErp.cidade} - {pedidoErp.uf}</p>
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                    {pedidoErp.cep && <p className="text-muted-foreground">CEP: {pedidoErp.cep}</p>}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Produto */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" /> Produto
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.produto || '-'}</p>
                    {pedidoErp.departamento && <p className="text-muted-foreground">Marca: {pedidoErp.departamento}</p>}
                    {pedidoErp.codigo_item_bseller && <p className="text-muted-foreground">ID: {pedidoErp.codigo_item_bseller}</p>}
                    {pedidoErp.codigo_item_vtex && <p className="text-muted-foreground">SKU: {pedidoErp.codigo_item_vtex}</p>}
                    {pedidoErp.codigo_fornecedor && <p className="text-muted-foreground">Cód. Fornecedor: {pedidoErp.codigo_fornecedor}</p>}
                    {pedidoErp.quantidade && <p className="text-muted-foreground">Qtde: {pedidoErp.quantidade}</p>}
                    {pedidoErp.preco_final && (
                      <p className="text-muted-foreground">
                        Valor: R$ {parseFloat(pedidoErp.preco_final).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Entrega */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Entrega
                  </h4>
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
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Nota Fiscal
                    </h4>
                    <div className="pl-6 space-y-1 text-sm">
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <p><span className="text-muted-foreground">NF:</span> {pedidoErp.nota_fiscal}</p>
                        {pedidoErp.uf_galpao && pedidoErp.uf_galpao !== '-' && (
                          <p><span className="text-muted-foreground">Galpão:</span> <span className="font-medium">{pedidoErp.uf_galpao}</span></p>
                        )}
                      </div>
                      {pedidoErp.chave_nota && (
                        <p className="text-xs text-muted-foreground break-all">Chave: {pedidoErp.chave_nota}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Classificação */}
        {pedidoErp && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  2. Classificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>Solicitação (Parceiro)</Label>
                    <Input
                      value={formData.solicitacao}
                      onChange={(e) => handleChange('solicitacao', e.target.value)}
                      placeholder="Nº da solicitação"
                      data-testid="input-solicitacao"
                    />
                  </div>

                  <div>
                    <Label>Parceiro/Canal</Label>
                    <Input
                      value={formData.parceiro}
                      onChange={(e) => handleChange('parceiro', e.target.value)}
                      placeholder="Ex: CSU, Livelo"
                      data-testid="input-parceiro"
                    />
                  </div>

                  <div>
                    <Label>Atendente</Label>
                    <Select value={formData.atendente} onValueChange={(v) => handleChange('atendente', v)}>
                      <SelectTrigger data-testid="select-atendente">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATENDENTES.map(a => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label>Categoria *</Label>
                    <Select value={formData.categoria} onValueChange={(v) => handleChange('categoria', v)}>
                      <SelectTrigger data-testid="select-categoria">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label>Motivo</Label>
                    <Input
                      value={formData.motivo}
                      onChange={(e) => handleChange('motivo', e.target.value)}
                      placeholder="Motivo específico do atendimento"
                      data-testid="input-motivo"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label>Motivo da Pendência</Label>
                    <Select value={motivoPendencia} onValueChange={setMotivoPendencia}>
                      <SelectTrigger data-testid="select-motivo-pendencia">
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTIVOS_PENDENCIA.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {pedidoErp?.status_pedido && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Status atual: {pedidoErp.status_pedido}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações rápidas */}
                {formData.categoria && (
                  <div className="space-y-3 pt-2">
                    {formData.categoria === 'Produto com Avaria' ? (
                      <div className="space-y-2">
                        <Label>Tipo de Avaria</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            type="button" 
                            variant={selectedAvaria === 'Avaria - Necessário Evidência' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => loadTextoAvaria('Avaria - Necessário Evidência')}
                            data-testid="btn-avaria-evidencia"
                          >
                            Necessário Evidência
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedAvaria === 'Avaria - Transporte até R$250' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => loadTextoAvaria('Avaria - Transporte até R$250')}
                            data-testid="btn-avaria-250"
                          >
                            Transporte até R$250
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedAvaria === 'Avaria - Reversa' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => loadTextoAvaria('Avaria - Reversa')}
                            data-testid="btn-avaria-reversa"
                          >
                            Reversa
                          </Button>
                        </div>
                      </div>
                    ) : formData.categoria === 'Falha Produção' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>Tipo de Resposta</Label>
                          {transportadoraDetectada && pedidoErp?.transportadora && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Transportadora: {pedidoErp.transportadora}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            type="button" 
                            variant={selectedFalhaProducao === 'Sem Rastreio' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => loadTextoFalhaProducao('Sem Rastreio')}
                            data-testid="btn-producao-sem-rastreio"
                          >
                            Sem Rastreio
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedFalhaProducao === 'Com Rastreio - Total Express' ? 'default' : (transportadoraDetectada === 'Com Rastreio - Total Express' ? 'secondary' : 'outline')}
                            size="sm"
                            onClick={() => loadTextoFalhaProducao('Com Rastreio - Total Express')}
                            data-testid="btn-producao-total"
                            className={transportadoraDetectada === 'Com Rastreio - Total Express' ? 'ring-2 ring-blue-400' : ''}
                          >
                            Total Express {transportadoraDetectada === 'Com Rastreio - Total Express' && '✓'}
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedFalhaProducao === 'Com Rastreio - J&T Express' ? 'default' : (transportadoraDetectada === 'Com Rastreio - J&T Express' ? 'secondary' : 'outline')}
                            size="sm"
                            onClick={() => loadTextoFalhaProducao('Com Rastreio - J&T Express')}
                            data-testid="btn-producao-jt"
                            className={transportadoraDetectada === 'Com Rastreio - J&T Express' ? 'ring-2 ring-blue-400' : ''}
                          >
                            J&T Express {transportadoraDetectada === 'Com Rastreio - J&T Express' && '✓'}
                          </Button>
                          <Button 
                            type="button" 
                            variant={selectedFalhaProducao === 'Com Rastreio - ASAP Log' ? 'default' : (transportadoraDetectada === 'Com Rastreio - ASAP Log' ? 'secondary' : 'outline')}
                            size="sm"
                            onClick={() => loadTextoFalhaProducao('Com Rastreio - ASAP Log')}
                            data-testid="btn-producao-asap"
                            className={transportadoraDetectada === 'Com Rastreio - ASAP Log' ? 'ring-2 ring-blue-400' : ''}
                          >
                            ASAP Log {transportadoraDetectada === 'Com Rastreio - ASAP Log' && '✓'}
                          </Button>
                        </div>
                      </div>
                    ) : formData.categoria === 'Falha de Compras' ? (
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => loadTextoFalhaProducao('Sem Rastreio')}
                          data-testid="btn-texto-padrao"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Ver Texto Padrão
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => loadTextoPadrao(formData.categoria)}
                          data-testid="btn-texto-padrao"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Ver Texto Padrão
                        </Button>
                        
                        {formData.categoria === 'Arrependimento' && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={gerarCodigoReversa}
                            data-testid="btn-gerar-reversa"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Gerar Código Reversa
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {codigoReversa && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Código de Reversa Gerado</p>
                        <p className="font-mono text-lg">{codigoReversa}</p>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(codigoReversa)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Anotações */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">3. Anotações</CardTitle>
                <CardDescription>Registre o histórico e observações do atendimento</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.anotacoes}
                  onChange={(e) => handleChange('anotacoes', e.target.value)}
                  placeholder="Descreva o histórico do atendimento..."
                  rows={5}
                  data-testid="textarea-anotacoes"
                />
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex justify-end gap-3 pb-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/chamados')}
                data-testid="btn-cancelar"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} size="lg" data-testid="btn-criar">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Atendimento'
                )}
              </Button>
            </div>
          </>
        )}
      </form>

      {/* Dialog: Lista de Pedidos (quando CPF retorna múltiplos) */}
      <Dialog open={showPedidosDialog} onOpenChange={setShowPedidosDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecione o Pedido</DialogTitle>
            <DialogDescription>
              Foram encontrados {pedidosList.length} pedidos para este CPF
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {pedidosList.map(pedido => (
              <div 
                key={pedido.numero_pedido}
                className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => selectPedido(pedido)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Entrega #{pedido.numero_pedido}</p>
                    <p className="text-sm text-muted-foreground">{pedido.produto}</p>
                    <p className="text-xs text-muted-foreground">{pedido.data_status}</p>
                  </div>
                  <Badge className={getStatusBadgeColor(pedido.status_pedido)}>
                    {pedido.status_pedido}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Texto Padrão */}
      <Dialog open={showTextoDialog} onOpenChange={setShowTextoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Texto Padrão - {formData.categoria}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Textarea
              value={textoPadrao}
              readOnly
              rows={12}
              className="font-mono text-sm"
            />
            <Button 
              variant="outline" 
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(textoPadrao)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTextoDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NovoAtendimento;
