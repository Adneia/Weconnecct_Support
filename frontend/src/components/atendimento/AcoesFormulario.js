import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle, RotateCcw } from 'lucide-react';
import { MOTIVOS_FINALIZADORES } from './constants';

const AcoesFormulario = ({
  isEditMode,
  loading,
  encerrarAoCriar,
  onEncerrarAoCriarChange,
  motivoPendencia,
  pendente,
  onEncerrar,
  onReabrir,
  onCancel,
}) => {
  return (
    <div className="flex justify-between pb-6" data-testid="acoes-formulario">
      <div>
        {isEditMode && pendente !== false && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={onEncerrar}
              disabled={loading || !MOTIVOS_FINALIZADORES.includes(motivoPendencia)}
              data-testid="btn-encerrar"
              title={!MOTIVOS_FINALIZADORES.includes(motivoPendencia)
                ? `Para encerrar, selecione um motivo finalizador: Entregue, Estornado, Atendido ou Em devolução`
                : 'Encerrar atendimento'}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Encerrar Atendimento
            </Button>
            {motivoPendencia && !MOTIVOS_FINALIZADORES.includes(motivoPendencia) && (
              <p className="text-xs text-amber-600">Motivo "{motivoPendencia}" não permite encerrar</p>
            )}
          </div>
        )}
        {isEditMode && pendente === false && (
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 py-2 px-4">
              <CheckCircle className="h-4 w-4 mr-2" />
              Atendimento Encerrado
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReabrir}
              disabled={loading}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              data-testid="btn-reabrir"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reabrir Atendimento
            </Button>
          </div>
        )}
      </div>
      <div className="flex gap-3 items-center">
        {!isEditMode && (
          <div className="flex items-center gap-2 mr-4">
            <input
              type="checkbox"
              id="encerrar-ao-criar"
              checked={encerrarAoCriar}
              onChange={(e) => onEncerrarAoCriarChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              data-testid="checkbox-encerrar"
            />
            <label htmlFor="encerrar-ao-criar" className="text-sm font-medium text-gray-700 dark:text-gray-300">Encerrar ao criar</label>
            {encerrarAoCriar && !MOTIVOS_FINALIZADORES.includes(motivoPendencia) && (
              <span className="text-xs text-amber-600 ml-1">(selecione um motivo finalizador)</span>
            )}
          </div>
        )}
        <Button type="button" variant="outline" onClick={onCancel} data-testid="btn-cancelar">Cancelar</Button>
        <Button
          type="submit"
          disabled={loading || (!isEditMode && encerrarAoCriar && !MOTIVOS_FINALIZADORES.includes(motivoPendencia))}
          size="lg"
          data-testid="btn-criar"
          className={encerrarAoCriar && MOTIVOS_FINALIZADORES.includes(motivoPendencia) ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditMode ? 'Atualizando...' : encerrarAoCriar ? 'Criando e Encerrando...' : 'Criando...'}
            </>
          ) : (
            <>
              {encerrarAoCriar && <CheckCircle className="h-4 w-4 mr-2" />}
              {isEditMode ? 'Atualizar Atendimento' : encerrarAoCriar ? 'Criar e Encerrar' : 'Criar Atendimento'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AcoesFormulario;
