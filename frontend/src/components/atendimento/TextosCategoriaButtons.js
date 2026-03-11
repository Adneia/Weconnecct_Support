import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { MessageSquare } from 'lucide-react';
import { getRastreioTransporte, getRastreioAcompanhamento } from './constants';

const TextosCategoriaButtons = ({
  categoria,
  pedidoErp,
  transportadoraDetectada,
  parceiro,
  selected,
  onLoadTexto,
}) => {
  if (!categoria) return null;

  if (categoria === 'Produto com Avaria') {
    return (
      <div className="space-y-2" data-testid="textos-avaria">
        <Label>Tipo de Avaria</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selected.avaria === 'Avaria - Necessário Evidência' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.avaria('Avaria - Necessário Evidência')} data-testid="btn-avaria-evidencia">Necessário Evidência</Button>
          <Button type="button" variant={selected.avaria === 'Avaria - Transporte até R$250' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.avaria('Avaria - Transporte até R$250')} data-testid="btn-avaria-250">Transporte até R$250</Button>
          <Button type="button" variant={selected.avaria === 'Avaria - Reversa' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.avaria('Avaria - Reversa')} data-testid="btn-avaria-reversa">Reversa</Button>
        </div>
      </div>
    );
  }

  if (categoria === 'Falha Produção') {
    return (
      <div className="space-y-2" data-testid="textos-falha-producao">
        <div className="flex items-center gap-2">
          <Label>Tipo de Resposta</Label>
          {transportadoraDetectada && pedidoErp?.transportadora && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Transportadora: {pedidoErp.transportadora}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selected.falhaProducao === 'Sem Rastreio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.falhaProducao('Sem Rastreio')} data-testid="btn-producao-sem-rastreio">Sem Rastreio</Button>
          {['Com Rastreio - Total Express', 'Com Rastreio - J&T Express', 'Com Rastreio - ASAP Log'].map(tipo => (
            <Button key={tipo} type="button"
              variant={selected.falhaProducao === tipo ? 'default' : (transportadoraDetectada === tipo ? 'secondary' : 'outline')}
              size="sm" onClick={() => onLoadTexto.falhaProducao(tipo)}
              className={transportadoraDetectada === tipo ? 'ring-2 ring-blue-400' : ''}
              data-testid={`btn-producao-${tipo.split(' - ')[1]?.toLowerCase().replace(/\s/g, '-')}`}
            >
              {tipo.replace('Com Rastreio - ', '')} {transportadoraDetectada === tipo && '✓'}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (categoria === 'Falha Compras') {
    return (
      <div className="space-y-2" data-testid="textos-falha-compras">
        <Label className="text-sm font-medium">Textos Padrão - Falha Compras</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onLoadTexto.padrao('Falha Compras')}><MessageSquare className="h-4 w-4 mr-2" />Em Preparação</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onLoadTexto.padrao('Falha Compras - Em Separação')}><MessageSquare className="h-4 w-4 mr-2" />Em Separação</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onLoadTexto.padrao('Falha Compras - Cancelamento sem Estoque')}><MessageSquare className="h-4 w-4 mr-2" />Cancelamento sem Estoque</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onLoadTexto.padrao('Falha Compras - Cancelado')}><MessageSquare className="h-4 w-4 mr-2" />Cancelado</Button>
        </div>
      </div>
    );
  }

  if (categoria === 'Falha Transporte') {
    const rastreioDetectado = getRastreioTransporte(pedidoErp?.transportadora);
    return (
      <div className="space-y-3" data-testid="textos-falha-transporte">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Enviar Rastreio</Label>
            {pedidoErp?.transportadora && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{pedidoErp.transportadora}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Rastreio - Total Express', 'Rastreio - J&T Express', 'Rastreio - ASAP Log', 'Rastreio - Correios'].map(tipo => {
              const isDetected = rastreioDetectado === tipo;
              return (
                <Button key={tipo} type="button" variant={selected.falhaTransporte === tipo ? 'default' : (isDetected ? 'secondary' : 'outline')} size="sm" onClick={() => onLoadTexto.falhaTransporte(tipo)} className={isDetected ? 'ring-2 ring-blue-400' : ''}>
                  {tipo.replace('Rastreio - ', '')} {isDetected && '✓'}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Bloqueio de Entrega</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.falhaTransporte === 'Bloqueio da Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.falhaTransporte('Bloqueio da Entrega')}>Bloqueio OK</Button>
            <Button type="button" variant={selected.falhaTransporte === 'Não é Possível Bloqueio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.falhaTransporte('Não é Possível Bloqueio')}>Não é Possível</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Extravio</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.falhaTransporte === 'Extravio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.falhaTransporte('Extravio')}>Extravio</Button>
            <Button type="button" variant={selected.falhaTransporte === 'Extravio com Previsão' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.falhaTransporte('Extravio com Previsão')}>Com Previsão</Button>
            <Button type="button" variant={selected.falhaTransporte === 'Extravio com Cancelamento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.falhaTransporte('Extravio com Cancelamento')}>Com Cancelamento</Button>
          </div>
        </div>
      </div>
    );
  }

  if (categoria === 'Falha Fornecedor') {
    return (
      <div className="space-y-3" data-testid="textos-falha-fornecedor">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Reversa</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.falhaFornecedor === '1ª Reversa' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.falhaFornecedor('1ª Reversa')}>1ª Reversa</Button>
            <Button type="button" variant={selected.falhaFornecedor === '2ª Reversa' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.falhaFornecedor('2ª Reversa')}>2ª Reversa</Button>
          </div>
        </div>
      </div>
    );
  }

  if (categoria === 'Arrependimento') {
    return (
      <div className="space-y-3" data-testid="textos-arrependimento">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Reversa</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.arrependimento === '1ª Reversa' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('1ª Reversa')}>1ª Reversa</Button>
            <Button type="button" variant={selected.arrependimento === '2ª Reversa' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('2ª Reversa')}>2ª Reversa</Button>
            <Button type="button" variant={selected.arrependimento === 'Reversa Irá Vencer' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Reversa Irá Vencer')}>Irá Vencer</Button>
            <Button type="button" variant={selected.arrependimento === 'Reversa Expirada' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Reversa Expirada')}>Expirada</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Em Devolução</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.arrependimento === 'Em Devolução - Sem Estorno' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Em Devolução - Sem Estorno')}>Sem Estorno</Button>
            <Button type="button" variant={selected.arrependimento === 'Em Devolução - Com Estorno' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Em Devolução - Com Estorno')}>Com Estorno</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Devolvido</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.arrependimento === 'Devolvido - Com Estorno' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Devolvido - Com Estorno')}>Com Estorno</Button>
            <Button type="button" variant={selected.arrependimento === 'Devolvido - Com Reenvio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Devolvido - Com Reenvio')}>Com Reenvio</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Bloqueio/Barragem</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.arrependimento === 'Bloqueio da Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Bloqueio da Entrega')}>Bloqueio OK</Button>
            <Button type="button" variant={selected.arrependimento === 'Enviado Sem Bloqueio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Enviado Sem Bloqueio')}>Sem Bloqueio</Button>
            <Button type="button" variant={selected.arrependimento === 'Em Separação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Em Separação')}>Em Separação</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Outros</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.arrependimento === 'Impossibilidade Coleta' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Impossibilidade Coleta')}>Sem Coleta</Button>
            <Button type="button" variant={selected.arrependimento === 'Prazo Expirado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.arrependimento('Prazo Expirado')}>Prazo Expirado</Button>
          </div>
        </div>
      </div>
    );
  }

  if (categoria === 'Acompanhamento') {
    const rastreioDetectado = getRastreioAcompanhamento(pedidoErp?.transportadora);
    return (
      <div className="space-y-3" data-testid="textos-acompanhamento">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status da Entrega</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.acompanhamento === 'Entregue - Possível Contestação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.acompanhamento('Entregue - Possível Contestação')}>Entregue (Possível Contestação)</Button>
            <Button type="button" variant={selected.acompanhamento === 'Entregue - Contestação Expirada' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.acompanhamento('Entregue - Contestação Expirada')}>Entregue (Contestação Expirada)</Button>
            <Button type="button" variant={selected.acompanhamento === 'Sem Comprovante de Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.acompanhamento('Sem Comprovante de Entrega')}>Sem Comprovante</Button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Em Processo de Entrega</Label>
            {pedidoErp?.transportadora && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{pedidoErp.transportadora}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Em Processo - Total Express', 'Em Processo - J&T Express', 'Em Processo - ASAP Log', 'Em Processo - Correios'].map(tipo => {
              const isDetected = rastreioDetectado === tipo;
              return (
                <Button key={tipo} type="button" variant={selected.acompanhamento === tipo ? 'default' : (isDetected ? 'secondary' : 'outline')} size="sm" onClick={() => onLoadTexto.acompanhamento(tipo)} className={isDetected ? 'ring-2 ring-blue-400' : ''}>
                  {tipo.replace('Em Processo - ', '')} {isDetected && '✓'}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Outros</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selected.acompanhamento === 'Cancelamento por Falta' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.acompanhamento('Cancelamento por Falta')}>Cancelamento por Falta</Button>
            <Button type="button" variant={selected.acompanhamento === 'Falha de Integração' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.acompanhamento('Falha de Integração')}>Falha de Integração</Button>
            <Button type="button" variant={selected.acompanhamento === 'Ag. Compras' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.acompanhamento('Ag. Compras')}>Ag. Compras</Button>
            <Button type="button" variant={selected.acompanhamento === 'Problema na Emissão da NF' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTexto.acompanhamento('Problema na Emissão da NF')}>Problema NF</Button>
          </div>
        </div>
      </div>
    );
  }

  if (categoria === 'Comprovante de Entrega') {
    return null;
  }

  if (categoria === 'Assistência Técnica') {
    const dept = pedidoErp?.departamento?.toLowerCase() || '';
    const matchFornecedor = (name) => dept.includes(name.toLowerCase());
    return (
      <div className="space-y-3" data-testid="textos-assistencia">
        {pedidoErp?.departamento && (
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              <span className="font-semibold">Fornecedor do pedido:</span> {pedidoErp.departamento}
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-sm font-medium">SAC do Fornecedor</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'Oderço', match: matchFornecedor('oderço') || matchFornecedor('oderco') },
              { key: 'Ventisol', match: matchFornecedor('ventisol') },
              { key: 'OEX', match: matchFornecedor('oex') },
              { key: 'Hoopson', match: matchFornecedor('hoopson') },
            ].map(({ key, match }) => (
              <Button key={key} type="button"
                variant={selected.assistencia === key ? 'default' : (match ? 'secondary' : 'outline')}
                size="sm" onClick={() => onLoadTexto.assistencia(key)}
                className={match ? 'ring-2 ring-emerald-500' : ''}
              >
                {match && '✓ '}{key}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">SAC + Opção Reversa</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'Ventisol + Reversa', match: matchFornecedor('ventisol') },
              { key: 'OEX + Reversa', match: matchFornecedor('oex') },
            ].map(({ key, match }) => (
              <Button key={key} type="button"
                variant={selected.assistencia === key ? 'default' : (match ? 'secondary' : 'outline')}
                size="sm" onClick={() => onLoadTexto.assistencia(key)}
                className={match ? 'ring-2 ring-emerald-500' : ''}
              >
                {match && '✓ '}{key}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default: generic text button
  return (
    <div className="flex gap-2" data-testid="textos-default">
      <Button type="button" variant="outline" size="sm" onClick={() => onLoadTexto.padrao(categoria)} data-testid="btn-texto-padrao">
        <MessageSquare className="h-4 w-4 mr-2" />
        Ver Texto Padrão
      </Button>
    </div>
  );
};

export default TextosCategoriaButtons;
