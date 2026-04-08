import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { MOTIVOS_PENDENCIA, MOTIVOS_FINALIZADORES } from './constants';
import { TEXTOS_RECLAME_AQUI } from './textos';

const MotivoPendenciaTextos = ({ motivoPendencia, selectedMotivoPendencia, onLoadTextoMotivoPendencia, onLoadTextoPadrao, onLoadTextoReversaAssistencia, onLoadTextoFalhaFornecedor, onLoadTextoComprovante, onLoadTextoFalhaTransporte, parceiro, pedidoErp, selectedAssistenciaAguardando }) => {
  if (motivoPendencia === 'Ag. Barrar') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 space-y-3">
        <Label className="text-sm font-medium text-orange-800 dark:text-orange-200">Textos Padrão - Ag. Barrar</Label>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Bloqueio de Entrega</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Barrar - Bloqueio Recusar' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Barrar - Bloqueio Recusar')}>Bloqueio + Recusar</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Barrar' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Barrar')}>Aguardando Barragem</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Barrar - Em Rota Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Barrar - Em Rota Entrega')}>Em Rota de Entrega</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Barrar - Acareação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Barrar - Acareação')}>Acareação</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Em Devolução</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Barrar - Aguardando Recebimento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Barrar - Aguardando Recebimento')}>Aguardando Recebimento</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Barrar - Com Rastreio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Barrar - Com Rastreio')}>Com Rastreio</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Barrar - Insucesso Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Barrar - Insucesso Entrega')}>Insucesso na Entrega</Button>
          </div>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Ag. Confirmação de Entrega') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
        <Label className="text-sm font-medium text-amber-800 dark:text-amber-200">Textos Padrão - Confirmação de Entrega</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Confirmação de Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Confirmação de Entrega')}>Solicitar Confirmação</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Confirmação - Extravio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Confirmação - Extravio')}>Extravio</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Confirmação - Reenvio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Confirmação - Reenvio')}>Reenvio</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Confirmação - Confirmado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Confirmação - Confirmado')}>Confirmado</Button>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Ag. Parceiro') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-3">
        <Label className="text-sm font-medium text-purple-800 dark:text-purple-200">Textos Padrão - Ag. Parceiro</Label>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Evidência / Cancelamento</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Solicitar Evidências' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Solicitar Evidências')}>Solicitar Evidências</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Cancelamento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Cancelamento')}>Cancelamento</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Em Devolução' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Em Devolução')}>Em Devolução</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Estorno Descarte' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Estorno Descarte')}>Estorno + Descarte</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Exceção Estorno' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Exceção Estorno')}>Exceção - Estorno</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Confirmação Encerramento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Confirmação Encerramento')}>Confirmar Encerramento</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Código Expirado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Código Expirado')}>Código Expirado</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Cancelamento Avaria' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Cancelamento Avaria')}>Cancelamento Avaria</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Entregue</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Confirmar Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Confirmar Entrega')}>Confirmar Entrega (15d)</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Prazo Expirado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Prazo Expirado')}>Prazo Expirado</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Comprovante Email' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Comprovante Email')}>Comprovante Email (CSU)</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Integração / Extravio</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Vtex CSU' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Vtex CSU')}>Vtex + CSU</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Vtex Parceiro' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Vtex Parceiro')}>Vtex + Parceiro</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Extravio Reenvio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Extravio Reenvio')}>Extravio - Reenvio</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Extravio Cancelamento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Extravio Cancelamento')}>Extravio - Cancelamento</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Parceiro - Extravio Nova Preparação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Parceiro - Extravio Nova Preparação')}>Nova Preparação</Button>
          </div>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Ag. Cliente') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
        <Label className="text-sm font-medium text-indigo-800 dark:text-indigo-200">Textos Padrão - Ag. Cliente</Label>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Evidência / Cancelamento</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Solicitar Evidências' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Solicitar Evidências')}>Solicitar Evidências</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Em Devolução' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Em Devolução')}>Em Devolução</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Estorno Descarte' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Estorno Descarte')}>Estorno + Descarte</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Exceção Estorno' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Exceção Estorno')}>Exceção - Estorno</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Confirmação Encerramento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Confirmação Encerramento')}>Confirmar Encerramento</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Código Expirado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Código Expirado')}>Código Expirado</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Cancelamento Avaria' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Cancelamento Avaria')}>Cancelamento Avaria</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Entregue</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Confirmação de Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Confirmação de Entrega')}>Confirmar Entrega</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Confirmar Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Confirmar Entrega')}>Confirmar Entrega (15d)</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Prazo Expirado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Prazo Expirado')}>Prazo Expirado</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Comprovante Email' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Comprovante Email')}>Comprovante Email (CSU)</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Integração / Extravio</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Vtex CSU' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Vtex CSU')}>Vtex + CSU</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Vtex Parceiro' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Vtex Parceiro')}>Vtex + Parceiro</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Extravio Reenvio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Extravio Reenvio')}>Extravio - Reenvio</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Extravio Cancelamento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Extravio Cancelamento')}>Extravio - Cancelamento</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Cliente - Extravio Nova Preparação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Cliente - Extravio Nova Preparação')}>Nova Preparação</Button>
          </div>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Ag. Fornecedor') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-2">
        <Label className="text-sm font-medium text-teal-800 dark:text-teal-200">Textos Padrão - Ag. Fornecedor</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Fornecedor - Verificação Reposição' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Fornecedor - Verificação Reposição')}>Verificação de Reposição</Button>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Em devolução') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2">
        <Label className="text-sm font-medium text-rose-800 dark:text-rose-200">Textos Padrão - Em Devolução</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selectedMotivoPendencia === 'Em devolução - Ag. Devolução' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Em devolução - Ag. Devolução')}>Ag. Devolução</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Em devolução - Liberar Estorno' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Em devolução - Liberar Estorno')}>Liberar Estorno</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Em devolução - Confirmar Reenvio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Em devolução - Confirmar Reenvio')}>Confirmar Reenvio</Button>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Devolvido') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-2">
        <Label className="text-sm font-medium text-purple-800 dark:text-purple-200">Textos Padrão - Devolvido</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selectedMotivoPendencia === 'Devolvido - Problema Transportadora' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Devolvido - Problema Transportadora')}>Problema Transportadora</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Devolvido - Cancelamento e Estorno' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Devolvido - Cancelamento e Estorno')}>Cancelamento e Estorno</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Devolvido - Reenvio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Devolvido - Reenvio')}>Reenvio</Button>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Aguardando') {
    const dept = pedidoErp?.departamento?.toLowerCase() || '';
    const fornecedoresAssistencia = ['ventisol', 'oex', 'oderço', 'oderco', 'hoopson'];
    const isFornecedorAssistencia = fornecedoresAssistencia.some(f => dept.includes(f));
    const matchFornecedor = (name) => dept.includes(name.toLowerCase());

    return (
      <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 space-y-3">
        <Label className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Textos Padrão - Aguardando</Label>

        {pedidoErp?.departamento && (
          <div className={`p-2 rounded-lg border text-sm ${isFornecedorAssistencia ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
            <span className="font-semibold">Fornecedor:</span> {pedidoErp.departamento}
            {isFornecedorAssistencia && <span className="ml-2 text-xs font-medium">(Recomendado: Reversa com Assistência)</span>}
            {!isFornecedorAssistencia && <span className="ml-2 text-xs font-medium">(Recomendado: 1ª Reversa)</span>}
          </div>
        )}

        {/* Reversa */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Reversa</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button"
              variant={selectedAssistenciaAguardando === '1ª Reversa' ? 'default' : (!isFornecedorAssistencia && pedidoErp?.departamento ? 'secondary' : 'outline')}
              size="sm" onClick={() => onLoadTextoFalhaFornecedor('1ª Reversa')}
              className={!isFornecedorAssistencia && pedidoErp?.departamento ? 'ring-2 ring-blue-400' : ''}>
              {!isFornecedorAssistencia && pedidoErp?.departamento && '> '}1ª Reversa
            </Button>
            <Button type="button" variant={selectedAssistenciaAguardando === '2ª Reversa' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoFalhaFornecedor('2ª Reversa')}>2ª Reversa</Button>
          </div>
        </div>

        {/* Reversa com Assistência Técnica */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Reversa com Assistência Técnica</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'Ventisol', match: matchFornecedor('ventisol') },
              { key: 'OEX', match: matchFornecedor('oex') },
              { key: 'Oderço', match: matchFornecedor('oderço') || matchFornecedor('oderco') },
              { key: 'Hoopson', match: matchFornecedor('hoopson') },
            ].map(({ key, match }) => (
              <Button key={key} type="button"
                variant={selectedAssistenciaAguardando === `Reversa Assistência - ${key}` ? 'default' : (match ? 'secondary' : 'outline')}
                size="sm" onClick={() => onLoadTextoReversaAssistencia(key)}
                className={match ? 'ring-2 ring-emerald-500' : ''}>
                {match && '> '}{key}
              </Button>
            ))}
          </div>
        </div>

        {/* Objeto não postado */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Postagem</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Aguardando - Objeto Não Postado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Aguardando - Objeto Não Postado')}>Objeto Não Postado</Button>
          </div>
        </div>
        {/* Em Devolução */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Em Devolução</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Aguardando - Aguardando Recebimento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Aguardando - Aguardando Recebimento')}>Aguardando Recebimento</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Aguardando - Com Rastreio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Aguardando - Com Rastreio')}>Com Rastreio</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Aguardando - Insucesso Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Aguardando - Insucesso Entrega')}>Insucesso na Entrega</Button>
          </div>
        </div>
        {/* Textos gerais de Aguardando */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Outros</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Aguardando - Encerramento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Aguardando - Encerramento')}>Encerramento</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Aguardando - Prazo Expirado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Aguardando - Prazo Expirado')}>Prazo Expirado</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Aguardando - Próximo de Vencer' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Aguardando - Próximo de Vencer')}>Próximo de Vencer</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Aguardando - Encerrado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Aguardando - Encerrado')}>Encerrado</Button>
          </div>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Entregue') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 space-y-3">
        <Label className="text-sm font-medium text-green-800 dark:text-green-200">Textos Padrão - Entregue</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selectedMotivoPendencia === 'Entregue - Confirmação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Entregue - Confirmação')}>Confirmação</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Entregue - Encerramento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Entregue - Encerramento')}>Encerramento</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Entregue - Prazo Expirado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Entregue - Prazo Expirado')}>Prazo Expirado</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Entregue - Próximo de Vencer' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Entregue - Próximo de Vencer')}>Próximo de Vencer</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Entregue - Encerrado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Entregue - Encerrado')}>Encerrado</Button>
        </div>
        {/* Comprovante de Entrega */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Comprovante de Entrega</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Comprovante - Confirmação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoComprovante('Confirmação')}>Confirmação</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Comprovante - Dentro do Prazo' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoComprovante('Dentro do Prazo')}>Dentro do Prazo</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Comprovante - Expirado' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoComprovante('Expirado')}>Expirado</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Comprovante - Expirado para Encerrar' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoComprovante('Expirado para Encerrar')}>Expirado p/ Encerrar</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Comprovante - Email CSU' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoComprovante('Email CSU')}>Email CSU</Button>
          </div>
        </div>
        {/* Comprovante (do Falha Transporte) */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Comprovante - Verificação</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'FT-Falta Comprovante' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoFalhaTransporte('Falta Comprovante')}>Falta Comprovante</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'FT-Desconhece No Prazo' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoFalhaTransporte('Desconhece Entrega - No Prazo')}>Desconhece (No Prazo)</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'FT-Desconhece Fora Prazo' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoFalhaTransporte('Desconhece Entrega - Fora Prazo')}>Desconhece (Fora Prazo)</Button>
            {parceiro?.toLowerCase().includes('csu') && (
              <Button type="button" variant={selectedMotivoPendencia === 'FT-CSU Email' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoFalhaTransporte('CSU - Comprovante Email')} className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">CSU - Email</Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Ag. Logística') {
    const transportadora = pedidoErp?.transportadora || '';
    const matchT = (n) => transportadora.toLowerCase().includes(n.toLowerCase());
    const tDest = matchT('Total') || matchT('tex') ? 'Total Express' : matchT('J&T') ? 'J&T Express' : matchT('ASAP') ? 'ASAP Log' : null;

    return (
      <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3">
        <Label className="text-sm font-medium text-blue-800 dark:text-blue-200">
          Textos Padrão - Ag. Logística {tDest && <span className="ml-1 text-xs font-normal">★ {tDest}</span>}
        </Label>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Atraso com rastreio</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Total Express', key: 'Ag. Logística - Atraso Total Express' },
              { label: 'J&T Express',   key: 'Ag. Logística - Atraso J&T Express'   },
              { label: 'ASAP Log',      key: 'Ag. Logística - Atraso ASAP Log'      },
            ].map(({ label, key }) => (
              <Button key={key} type="button" size="sm"
                variant={selectedMotivoPendencia === key ? 'default' : tDest === label ? 'secondary' : 'outline'}
                className={tDest === label ? 'ring-2 ring-blue-400' : ''}
                onClick={() => onLoadTextoMotivoPendencia(key)}>
                {tDest === label && '★ '}{label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Atraso sem rastreio</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Logística - Em Preparação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Logística - Em Preparação')}>Em Preparação</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Logística - Em Separação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Logística - Em Separação')}>Em Separação</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Logística - Acionando Transportadora' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Logística - Acionando Transportadora')}>Acionando Transportadora</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Reenvio</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Logística - Reenvio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Logística - Reenvio')}>Reenvio do Item</Button>
          </div>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Ag. Transportadora - Asap' || motivoPendencia === 'Ag. Transportadora - J&T' || motivoPendencia === 'Ag. Transportadora - Total') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 space-y-3">
        <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">Textos Padrão - Ag. Transportadora</Label>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Bloqueio de Entrega</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Transportadora - Bloqueio Recusar' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Transportadora - Bloqueio Recusar')}>Bloqueio + Recusar</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Transportadora - Aguardando Barragem' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Transportadora - Aguardando Barragem')}>Aguardando Barragem</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Transportadora - Em Rota Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Transportadora - Em Rota Entrega')}>Em Rota de Entrega</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Transportadora - Acareação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Transportadora - Acareação')}>Acareação</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Em Devolução</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Transportadora - Aguardando Recebimento' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Transportadora - Aguardando Recebimento')}>Aguardando Recebimento</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Transportadora - Com Rastreio' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Transportadora - Com Rastreio')}>Com Rastreio</Button>
            <Button type="button" variant={selectedMotivoPendencia === 'Ag. Transportadora - Insucesso Entrega' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Transportadora - Insucesso Entrega')}>Insucesso na Entrega</Button>
          </div>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Ag. Compras') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-2">
        <Label className="text-sm font-medium text-purple-800 dark:text-purple-200">Textos Padrão - Ag. Compras</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Compras - Em Preparação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Compras - Em Preparação')}>Em Preparação</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Compras - Em Separação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Compras - Em Separação')}>Em Separação</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Compras - Cancelamento Avaria' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Compras - Cancelamento Avaria')}>Cancelamento por Avaria</Button>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Ag. Bseller') {
    return (
      <div className="mt-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 space-y-2">
        <Label className="text-sm font-medium text-violet-800 dark:text-violet-200">Textos Padrão - Ag. Bseller</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Bseller - Em Preparação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Bseller - Em Preparação')}>Em Preparação</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Bseller - Em Separação' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Bseller - Em Separação')}>Em Separação</Button>
          <Button type="button" variant={selectedMotivoPendencia === 'Ag. Bseller - Cancelamento Avaria' ? 'default' : 'outline'} size="sm" onClick={() => onLoadTextoMotivoPendencia('Ag. Bseller - Cancelamento Avaria')}>Cancelamento por Avaria</Button>
        </div>
      </div>
    );
  }

  if (motivoPendencia === 'Enviado') {
    const transportadora = pedidoErp?.transportadora || '';
    const matchTransp = (name) => transportadora.toLowerCase().includes(name.toLowerCase());
    const transpDestaque = matchTransp('Total') ? 'Total Express' : matchTransp('J&T') ? 'J&T Express' : matchTransp('ASAP') ? 'ASAP Log' : matchTransp('Correios') ? 'Correios' : null;

    return (
      <div className="mt-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-2">
        <Label className="text-sm font-medium text-sky-800 dark:text-sky-200">
          Textos Padrão - Enviado {transpDestaque && <span className="ml-1 text-xs font-normal">★ {transpDestaque}</span>}
        </Label>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Total Express', key: 'Enviado - Total Express' },
            { label: 'J&T Express',   key: 'Enviado - J&T Express'   },
            { label: 'ASAP Log',      key: 'Enviado - ASAP Log'      },
            { label: 'Correios',      key: 'Enviado - Correios'      },
          ].map(({ label, key }) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={selectedMotivoPendencia === key ? 'default' : transpDestaque === label ? 'secondary' : 'outline'}
              className={transpDestaque === label ? 'ring-2 ring-sky-400' : ''}
              onClick={() => onLoadTextoMotivoPendencia(key)}
            >
              {transpDestaque === label && '★ '}{label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

const SecaoAnotacoes = ({
  formData,
  onChangeField,
  isEditMode,
  fieldErrors,
  onFieldErrorClear,
  motivoPendencia,
  onMotivoPendenciaChange,
  codigoReversa,
  onCodigoReversaChange,
  dataVencimentoReversa,
  onDataVencimentoReversaChange,
  retornarChamado,
  onRetornarChamadoChange,
  verificarAdneia,
  onVerificarAdneiaChange,
  pedidoErp,
  selectedMotivoPendencia,
  selectedAssistenciaAguardando,
  onLoadTextoMotivoPendencia,
  onLoadTextoPadrao,
  onLoadTextoReversaAssistencia,
  onLoadTextoFalhaFornecedor,
  onLoadTextoComprovante,
  onLoadTextoFalhaTransporte,
  parceiro,
  onLoadTextoRaw,
}) => {
  const [textosMotivo, setTextosMotivo] = useState([]);
  const [causaSelecionada, setCausaSelecionada] = useState('');
  const [textosAbertos, setTextosAbertos] = useState(true);
  const [reclameAberto, setReclameAberto] = useState(true);
  const [selectedReclame, setSelectedReclame] = useState('');

  useEffect(() => {
    setCausaSelecionada('');
    if (!motivoPendencia) { setTextosMotivo([]); return; }
    const token = localStorage.getItem('token');
    fetch(`/api/motivo-textos/${encodeURIComponent(motivoPendencia)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setTextosMotivo(data.grupos || []))
      .catch(() => setTextosMotivo([]));
  }, [motivoPendencia]);

  useEffect(() => {
    if (textosMotivo.length === 1) setCausaSelecionada(textosMotivo[0].causa);
    else setCausaSelecionada('');
  }, [textosMotivo]);

  const addObservacao = (texto) => {
    if (!texto.trim()) return;
    const hoje = new Date().toLocaleDateString('pt-BR');
    const novaEntrada = `[${hoje}] ${texto.trim()}`;
    const anotacoesAtuais = formData.anotacoes;
    const novasAnotacoes = anotacoesAtuais
      ? `${novaEntrada}\n\n${anotacoesAtuais}`
      : novaEntrada;
    onChangeField('anotacoes', novasAnotacoes);
    if (fieldErrors.anotacoes) onFieldErrorClear('anotacoes');
  };

  const [reversaAberta, setReversaAberta] = useState(!!codigoReversa);
  const [historicoExpandido, setHistoricoExpandido] = useState(false);

  return (
    <Card className={fieldErrors.anotacoes ? 'border-red-500' : ''} data-testid="secao-anotacoes">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          3. Anotações {!isEditMode && <span className="text-red-500">*</span>}
        </CardTitle>
        <CardDescription>
          {fieldErrors.anotacoes
            ? <span className="text-red-500">É obrigatório adicionar uma anotação para salvar o atendimento</span>
            : isEditMode
              ? 'Registre o histórico e observações do atendimento (opcional na edição)'
              : 'Registre o histórico e observações do atendimento'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dados da Reversa - colapsável */}
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-blue-800 dark:text-blue-200"
            onClick={() => setReversaAberta(v => !v)}
          >
            <span>Dados da Reversa {codigoReversa && <span className="ml-2 text-xs font-normal text-blue-600">({codigoReversa})</span>}</span>
            {reversaAberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {reversaAberta && (
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Número da Reversa</Label>
                <Input value={codigoReversa} onChange={(e) => onCodigoReversaChange(e.target.value)} placeholder="Digite o código da reversa" className="mt-1" data-testid="input-numero-reversa" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data de Vencimento</Label>
                <Input type="date" value={dataVencimentoReversa} onChange={(e) => onDataVencimentoReversaChange(e.target.value)} className="mt-1" data-testid="input-data-vencimento-reversa" />
              </div>
            </div>
          )}
        </div>

        {/* Motivo da Pendência */}
        <div>
          <Label className={fieldErrors.motivoPendencia ? 'text-red-600' : ''}>
            Motivo da Pendência <span className="text-red-500">*</span>
          </Label>
          <Select value={motivoPendencia} onValueChange={onMotivoPendenciaChange}>
            <SelectTrigger data-testid="select-motivo-pendencia" className={fieldErrors.motivoPendencia ? 'border-red-500 focus:ring-red-500' : ''}>
              <SelectValue placeholder="Selecione o motivo" />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Motivos de Acompanhamento</div>
              {MOTIVOS_PENDENCIA.filter(m => !MOTIVOS_FINALIZADORES.includes(m)).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-2 pt-2">Motivos Finalizadores</div>
              {MOTIVOS_FINALIZADORES.map(m => (
                <SelectItem key={m} value={m} className="text-emerald-700 dark:text-emerald-400">✓ {m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pedidoErp?.status_pedido && (
            <p className="text-xs text-muted-foreground mt-1">Status atual: {pedidoErp.status_pedido}</p>
          )}

        </div>

        {/* Textos padrão por motivo — seção dinâmica via API */}
        {motivoPendencia && textosMotivo.length > 0 && (() => {
          const transp = pedidoErp?.transportadora;
          const transpNorm = transp ? transp.toLowerCase() : '';
          const transpLabel = (transpNorm.includes('total') || transpNorm.includes('tex')) ? 'Total Express'
            : (transpNorm.includes('j&t') || transpNorm.includes('jt') || transpNorm.includes('j t')) ? 'J&T Express'
            : (transpNorm.includes('asap') || transpNorm.includes('logistica e solucoes')) ? 'ASAP Log'
            : transpNorm.includes('correios') ? 'Correios'
            : transp || null;
          const titulosSelecionados = causaSelecionada
            ? (textosMotivo.find(g => g.causa === causaSelecionada)?.textos || [])
            : [];
          return (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                onClick={() => setTextosAbertos(v => !v)}
              >
                <span>
                  Textos Padrão{transpLabel && <span className="ml-2 text-blue-600 dark:text-blue-400">— ★ {transpLabel}</span>}
                </span>
                {textosAbertos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {textosAbertos && (
                <div className="px-3 pb-3 space-y-2">
                  {/* Nível 1: Causa — só mostra se houver mais de 1 opção */}
                  {textosMotivo.length > 1 && (
                    <select
                      className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={causaSelecionada}
                      onChange={e => setCausaSelecionada(e.target.value)}
                    >
                      <option value="">Selecione o tipo de texto...</option>
                      {textosMotivo.map(grupo => (
                        <option key={grupo.causa} value={grupo.causa}>{grupo.causa}</option>
                      ))}
                    </select>
                  )}
                  {/* Nível 2: Botões de título */}
                  {titulosSelecionados.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {titulosSelecionados.map(t => {
                        const tLow = t.titulo.toLowerCase();
                        const isMatch = transpLabel && (
                          tLow.includes(transpLabel.toLowerCase().split(' ')[0])
                        );
                        return (
                          <button
                            key={t.titulo}
                            type="button"
                            onClick={() => { if (onLoadTextoRaw) onLoadTextoRaw(t.texto, t.titulo); }}
                            className={isMatch
                              ? 'px-3 py-1.5 text-sm rounded-md font-medium bg-amber-500 text-white border border-amber-500 hover:bg-amber-600'
                              : titulosSelecionados.length === 1
                                ? 'px-3 py-1.5 text-sm rounded-md font-medium bg-slate-800 text-white border border-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-800'
                                : 'px-3 py-1.5 text-sm rounded-md font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600'
                            }
                          >
                            {isMatch ? `★ ${t.titulo}` : t.titulo}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Textos padrão por motivo — seções locais (constants.js) */}
        <MotivoPendenciaTextos
          motivoPendencia={motivoPendencia}
          selectedMotivoPendencia={selectedMotivoPendencia}
          onLoadTextoMotivoPendencia={onLoadTextoMotivoPendencia}
          onLoadTextoPadrao={onLoadTextoPadrao}
          onLoadTextoReversaAssistencia={onLoadTextoReversaAssistencia}
          onLoadTextoFalhaFornecedor={onLoadTextoFalhaFornecedor}
          onLoadTextoComprovante={onLoadTextoComprovante}
          onLoadTextoFalhaTransporte={onLoadTextoFalhaTransporte}
          parceiro={parceiro}
          pedidoErp={pedidoErp}
          selectedAssistenciaAguardando={selectedAssistenciaAguardando}
        />

        {/* Campo para nova observação */}
        <div className="space-y-3">
          <Label className={fieldErrors.anotacoes ? 'text-red-600' : ''}>
            Anotações <span className="text-red-500">*</span>
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Textarea
                id="nova-observacao"
                placeholder="Digite uma nova observação..."
                rows={2}
                data-testid="textarea-nova-observacao"
                className={fieldErrors.anotacoes && !formData.anotacoes ? 'border-red-500 focus:ring-red-500' : ''}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const input = e.target;
                    addObservacao(input.value);
                    input.value = '';
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-end"
              onClick={() => {
                const input = document.getElementById('nova-observacao');
                addObservacao(input.value);
                input.value = '';
              }}
              data-testid="btn-adicionar-observacao"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {/* Histórico de anotações */}
          {formData.anotacoes && (() => {
            const entradas = formData.anotacoes.split('\n\n').filter(e => e.trim());
            const maisAnteriores = entradas.length - 1;
            return (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border overflow-hidden">
                {/* Entrada mais recente — sempre visível */}
                <div className="p-3">
                  <div className="text-sm whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300">{entradas[0]}</div>
                </div>
                {/* Entradas anteriores — colapsáveis */}
                {maisAnteriores > 0 && (
                  <>
                    {historicoExpandido && (
                      <div className="px-3 pb-3 space-y-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                        {entradas.slice(1).map((entrada, i) => (
                          <div key={i} className="text-sm whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300">{entrada}</div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 border-t border-slate-200 dark:border-slate-700 transition-colors"
                      onClick={() => setHistoricoExpandido(v => !v)}
                    >
                      {historicoExpandido
                        ? <><ChevronUp className="h-3 w-3" /> Recolher</>
                        : <><ChevronDown className="h-3 w-3" /> Ver mais {maisAnteriores} {maisAnteriores === 1 ? 'anotação anterior' : 'anotações anteriores'}</>
                      }
                    </button>
                  </>
                )}
              </div>
            );
          })()}
          <input type="hidden" value={formData.anotacoes} />
        </div>

        {/* Checkboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="retornar-chamado" checked={retornarChamado} onChange={(e) => onRetornarChamadoChange(e.target.checked)} className="w-5 h-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500" data-testid="checkbox-retornar" />
              <Label htmlFor="retornar-chamado" className="text-amber-800 dark:text-amber-200 font-medium cursor-pointer">Retornar Chamado</Label>
            </div>
            {retornarChamado && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Aguardando</Badge>}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="verificar-adneia" checked={verificarAdneia} onChange={(e) => onVerificarAdneiaChange(e.target.checked)} className="w-5 h-5 rounded border-purple-400 text-purple-600 focus:ring-purple-500" data-testid="checkbox-verificar-adneia" />
              <Label htmlFor="verificar-adneia" className="text-purple-800 dark:text-purple-200 font-medium cursor-pointer">Verificar</Label>
            </div>
            {verificarAdneia && <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">Aguardando</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecaoAnotacoes;
