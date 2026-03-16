import { useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, AlertTriangle, Loader2, X, Download } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ImportarPedidos = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const { getAuthHeader } = useAuth();

  const parseFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = e.target.result;
          let rows = [];
          
          if (file.name.endsWith('.csv')) {
            // Parse CSV
            const Papa = await import('papaparse');
            const parsed = Papa.default.parse(data, { header: true });
            rows = parsed.data.slice(0, 5);
          } else {
            // Parse Excel
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            rows = jsonData.slice(0, 5);
          }
          
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFile = async (selectedFile) => {
    if (!selectedFile) return;
    
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      toast.error('Formato inválido. Use CSV ou Excel (.xlsx, .xls)');
      return;
    }

    setFile(selectedFile);
    setResult(null);
    
    try {
      const rows = await parseFile(selectedFile);
      setPreview(rows);
    } catch (error) {
      toast.error('Erro ao ler arquivo');
      setPreview(null);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecione um arquivo');
      return;
    }

    // Verificar tamanho do arquivo (max 100MB)
    const maxSizeMB = 100;
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > maxSizeMB) {
      toast.error(`Arquivo muito grande (${fileSizeMB.toFixed(1)}MB). Máximo: ${maxSizeMB}MB.`);
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      toast.info(`Enviando arquivo (${fileSizeMB.toFixed(1)}MB)... Aguarde.`);

      const response = await axios.post(
        `${API_URL}/api/pedidos-erp/import`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data'
          },
          timeout: 120000, // 2 minutos (proxy tem ~60s)
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            if (percentCompleted < 100) {
              // Update progress toast
            }
          }
        }
      );

      // Verificar se é processamento em background
      if (response.data.status === 'processing') {
        const importId = response.data.import_id || 'unknown';
        const totalRows = response.data.total_rows || 0;
        toast.info(`Importação de ${totalRows} linhas iniciada. Aguarde...`);
        setResult({ 
          success: true, 
          message: `Importação de ${totalRows} linhas iniciada em background.`,
          isBackground: true,
          importId: importId,
          totalRows: totalRows
        });
        
        // Iniciar polling para verificar status
        pollImportStatus(importId);
      } else {
        setResult({ success: true, message: response.data.message });
        toast.success('Importação concluída!');
        setUploading(false);
      }
    } catch (error) {
      console.error('Erro de importação:', error);
      let errorMessage = 'Erro ao importar arquivo';
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Timeout: O arquivo é muito grande. Exporte apenas os pedidos dos últimos 7-15 dias.';
      } else if (error.response?.status === 503) {
        errorMessage = 'Servidor ocupado ou timeout. Exporte apenas os pedidos recentes (últimos 7-15 dias).';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setResult({ 
        success: false, 
        message: errorMessage
      });
      toast.error(errorMessage);
      setUploading(false);
    }
  };

  // Função para verificar status de importação em background
  const pollImportStatus = async (importId) => {
    const maxRetries = 300; // 10 minutos máximo (2s * 300)
    let retries = 0;

    const checkStatus = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/pedidos-erp/import-status/${importId}`,
          { headers: getAuthHeader() }
        );
        
        const data = response.data;
        
        if (data.status === 'completed') {
          setResult({ 
            success: true, 
            message: `Importação concluída: ${data.inserted || 0} novos, ${data.updated || 0} atualizados, ${data.skipped || 0} ignorados, ${data.errors || 0} erros`,
            progress: 100,
            isComplete: true
          });
          toast.success('Importação concluída!');
          setUploading(false);
          return true;
        } else if (data.status === 'error') {
          setResult({ 
            success: false, 
            message: `Erro na importação: ${data.error || 'Erro desconhecido'}`
          });
          toast.error('Erro na importação');
          setUploading(false);
          return true;
        } else {
          // Ainda processando
          const processed = data.processed || 0;
          const totalRows = data.total_rows || data.total || 0;
          const progress = totalRows > 0 ? Math.round((processed / totalRows) * 100) : (data.progress || 0);
          setResult({ 
            success: true, 
            message: `Processando... ${processed} de ${totalRows} linhas`,
            details: `${data.inserted || 0} novos, ${data.updated || 0} atualizados`,
            progress: progress,
            totalRows: totalRows,
            processed: processed,
            isBackground: true
          });
          return false;
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
        retries++;
        if (retries >= maxRetries) {
          setResult({ 
            success: false, 
            message: 'Timeout ao verificar status da importação. Verifique os dados.'
          });
          setUploading(false);
          return true;
        }
        return false;
      }
    };
    
    const interval = setInterval(async () => {
      const completed = await checkStatus();
      if (completed) {
        clearInterval(interval);
      }
    }, 2000);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  const downloadTemplate = () => {
    const csvContent = `numero_pedido,status_pedido,nota_fiscal,chave_nota,codigo_rastreio,transportadora
12345,Enviado,NF-001,35240812345678901234567890123456789012345678,AA123456789BR,Correios
12346,Entregue,NF-002,35240812345678901234567890123456789012345679,BB987654321BR,Total Express`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_pedidos.csv';
    link.click();
  };

  const [corrigindo, setCorrigindo] = useState(false);
  const [correcaoResult, setCorrecaoResult] = useState(null);
  const [importandoBackup, setImportandoBackup] = useState(false);
  const [backupResult, setBackupResult] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [corrigindoMotivos, setCorrigindoMotivos] = useState(false);
  const [motivosResult, setMotivosResult] = useState(null);
  const [limpandoTestes, setLimpandoTestes] = useState(false);

  const corrigirNumeros = async () => {
    if (!window.confirm('Isso vai corrigir números de pedido com ".0" no final (ex: 117552503.0 → 117552503). Continuar?')) return;
    setCorrigindo(true);
    setCorrecaoResult(null);
    try {
      const response = await axios.post(`${API_URL}/api/admin/corrigir-numero-pedido`, {}, { headers: getAuthHeader() });
      setCorrecaoResult(response.data);
      toast.success(`Correção concluída: ${response.data.pedidos_numero_corrigido} pedidos e ${response.data.campos_corrigidos} campos corrigidos`);
    } catch (error) {
      toast.error('Erro ao corrigir números');
    } finally { setCorrigindo(false); }
  };

  const importarBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm(`Importar backup "${file.name}"? Isso vai atualizar registros existentes e criar novos conforme o arquivo.`)) {
      e.target.value = '';
      return;
    }
    setImportandoBackup(true);
    setBackupResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API_URL}/api/admin/importar-backup`, formData, {
        headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
        timeout: 300000
      });
      setBackupResult(response.data);
      toast.success(`Backup importado: ${response.data.resumo.atualizados} atualizados, ${response.data.resumo.criados} criados`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao importar backup');
    } finally {
      setImportandoBackup(false);
      e.target.value = '';
    }
  };

  const corrigirMotivos = async () => {
    if (!window.confirm('Isso vai verificar todos os chamados pendentes e corrigir o Motivo de Pendência quando não corresponder ao Status do Pedido (ex: status "PROCESSAMENTO NA FILAL" com motivo "Entregue" será corrigido para "Enviado"). Continuar?')) return;
    setCorrigindoMotivos(true);
    setMotivosResult(null);
    try {
      const response = await axios.post(`${API_URL}/api/admin/corrigir-motivos-inconsistentes`, {}, {
        headers: getAuthHeader(),
        timeout: 120000
      });
      setMotivosResult(response.data);
      toast.success(`Correção concluída: ${response.data.stats.corrigidos} motivos corrigidos`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao corrigir motivos');
    } finally { setCorrigindoMotivos(false); }
  };

  const limparDadosTeste = async () => {
    if (!window.confirm('Isso vai EXCLUIR todos os registros de teste (TESTE-*, TEST_*) que migraram do preview. Continuar?')) return;
    setLimpandoTestes(true);
    try {
      const response = await axios.post(`${API_URL}/api/admin/limpar-dados-teste`, {}, {
        headers: getAuthHeader(),
        timeout: 60000
      });
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao limpar dados de teste');
    } finally { setLimpandoTestes(false); }
  };

  const sincronizarSheets = async () => {
    if (!window.confirm('Sincronizar todos os atendimentos pendentes com o Google Sheets? Isso pode demorar alguns minutos.')) return;
    setSincronizando(true);
    setSyncResult(null);
    try {
      const response = await axios.post(`${API_URL}/api/google-sheets/sync-all`, {}, {
        headers: getAuthHeader(),
        timeout: 300000
      });
      setSyncResult(response.data);
      if (response.data.success) {
        toast.success(`Sync concluído: ${response.data.added} adicionados, ${response.data.updated} atualizados`);
      } else {
        toast.error(response.data.error || 'Erro no sync');
      }
    } catch (error) {
      toast.error('Erro ao sincronizar com Google Sheets');
    } finally { setSincronizando(false); }
  };

  return (
    <div className="space-y-6" data-testid="importar-pedidos-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Importar Pedidos</h1>
          <p className="text-muted-foreground text-sm">Importe dados dos pedidos do ERP via arquivo CSV ou Excel</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate} data-testid="btn-download-template">
          <Download className="h-4 w-4 mr-2" />
          Baixar Template
        </Button>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instruções - Tabelão ELO</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            {/* Alerta sobre tamanho */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <p className="font-medium">⚠️ Tamanho máximo: 10MB</p>
              <p className="text-xs mt-1">Para arquivos maiores, exporte apenas os pedidos dos últimos 7-15 dias ou divida em partes menores.</p>
            </div>
            
            <p>O sistema reconhece automaticamente o arquivo <strong>Tabelão de Pedidos Vendas</strong> do ERP. Colunas mapeadas:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { name: 'Entrega Ped.', desc: 'Número do pedido' },
                { name: 'Dt. Emissao', desc: 'Data emissão' },
                { name: 'Nome', desc: 'Nome do cliente' },
                { name: 'Ult. Ponto Nome', desc: 'Status do pedido' },
                { name: 'Transportadora Nome', desc: 'Transportadora' },
                { name: 'Depto Nome', desc: 'Produto' },
                { name: 'Nota Série', desc: 'Nota fiscal' },
                { name: 'Chave Acesso', desc: 'Chave NF-e' },
                { name: 'Canal de vendas Nome', desc: 'Canal de vendas' },
                { name: 'CEP/Cidade/UF', desc: 'Localização' },
                { name: 'Qtde Pedido', desc: 'Quantidade' },
                { name: 'Preço Final', desc: 'Valor' }
              ].map(col => (
                <div key={col.name} className="p-3 rounded-lg bg-muted/50">
                  <code className="text-xs font-medium">{col.name}</code>
                  <p className="text-xs text-muted-foreground mt-1">{col.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground">
              Pedidos existentes serão atualizados automaticamente. Novos pedidos serão criados.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload do Arquivo</CardTitle>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              data-testid="dropzone"
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Arraste e solte o arquivo aqui</p>
              <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => handleFile(e.target.files[0])}
                className="hidden"
                id="file-input"
                data-testid="input-file"
              />
              <label htmlFor="file-input">
                <Button variant="outline" asChild>
                  <span>Selecionar Arquivo</span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-4">
                Formatos aceitos: CSV, Excel (.xlsx, .xls)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} data-testid="btn-clear-file">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Preview */}
              {preview && preview.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Preview (primeiras 5 linhas):</p>
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(preview[0]).map((key) => (
                            <TableHead key={key} className="text-xs whitespace-nowrap">
                              {key}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row, idx) => (
                          <TableRow key={idx}>
                            {Object.values(row).map((value, i) => (
                              <TableCell key={i} className="text-xs whitespace-nowrap">
                                {String(value || '-').substring(0, 30)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex justify-end">
                <Button onClick={handleUpload} disabled={uploading} data-testid="btn-importar">
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Dados
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result / Progress */}
      {result && (
        <Card className={result.success ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'} data-testid="import-result">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {result.isBackground && !result.isComplete ? (
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin flex-shrink-0" />
              ) : result.success ? (
                <CheckCircle className="h-8 w-8 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-8 w-8 text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1 space-y-3">
                <div>
                  <p className={`font-medium ${
                    result.isBackground && !result.isComplete 
                      ? 'text-blue-700 dark:text-blue-400' 
                      : result.success 
                        ? 'text-emerald-700 dark:text-emerald-400' 
                        : 'text-red-700 dark:text-red-400'
                  }`}>
                    {result.isBackground && !result.isComplete 
                      ? 'Importando em Background...' 
                      : result.success 
                        ? 'Importação Concluída' 
                        : 'Erro na Importação'}
                  </p>
                  <p className="text-sm text-muted-foreground">{result.message}</p>
                  {result.details && (
                    <p className="text-xs text-muted-foreground mt-1">{result.details}</p>
                  )}
                </div>
                
                {/* Barra de Progresso */}
                {result.isBackground && result.progress !== undefined && (
                  <div className="space-y-2">
                    <Progress value={result.progress} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{result.processed || 0} de {result.totalRows || '?'} linhas</span>
                      <span className="font-medium">{result.progress}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importar Backup de Atendimentos */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-400">Importar Backup de Atendimentos</p>
                <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
                  Atualiza atendimentos existentes e cria novos a partir do arquivo Excel de backup
                </p>
                {backupResult && (
                  <div className="mt-2 text-xs space-y-1 flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      {backupResult.resumo.atualizados} atualizados
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                      {backupResult.resumo.criados} criados
                    </Badge>
                    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300">
                      {backupResult.resumo.sem_mudanca} sem mudança
                    </Badge>
                    {backupResult.resumo.erros > 0 && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                        {backupResult.resumo.erros} erros
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            <label className="shrink-0">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={importarBackup}
                className="hidden"
                disabled={importandoBackup}
                data-testid="input-importar-backup"
              />
              <div className={`inline-flex items-center justify-center rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 cursor-pointer ${importandoBackup ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {importandoBackup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {importandoBackup ? 'Importando...' : 'Selecionar Backup'}
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Correção de Números */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Corrigir Números da Base</p>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                  Remove sufixo ".0" de campos numéricos importados do Excel (CPF, entrega, telefone, etc.)
                </p>
                {correcaoResult && (
                  <div className="mt-2 text-xs space-y-1">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      {correcaoResult.pedidos_numero_corrigido} entregas corrigidas
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 ml-2">
                      {correcaoResult.campos_corrigidos} campos corrigidos
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={corrigirNumeros}
              disabled={corrigindo}
              className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
              data-testid="btn-corrigir-numeros"
            >
              {corrigindo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {corrigindo ? 'Corrigindo...' : 'Corrigir Números'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sincronizar Google Sheets */}
      <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <CheckCircle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-purple-700 dark:text-purple-400">Corrigir Motivos Inconsistentes</p>
                <p className="text-sm text-purple-600/80 dark:text-purple-400/80">
                  Verifica chamados pendentes cujo Motivo de Pendência não corresponde ao Status do Pedido e corrige automaticamente
                </p>
                {motivosResult && (
                  <div className="mt-2 text-xs flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                      {motivosResult.stats.verificados} verificados
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      {motivosResult.stats.corrigidos} corrigidos
                    </Badge>
                    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300">
                      {motivosResult.stats.ja_corretos} já corretos
                    </Badge>
                    {motivosResult.stats.detalhes?.length > 0 && (
                      <div className="w-full mt-2 max-h-32 overflow-y-auto text-xs border rounded p-2 bg-white dark:bg-gray-900">
                        {motivosResult.stats.detalhes.map((d, i) => (
                          <div key={i} className="py-0.5">
                            <span className="font-mono">{d.entrega}</span>: {d.de} → <span className="font-medium text-green-700">{d.para}</span> <span className="text-gray-400">({d.status_pedido})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={corrigirMotivos}
              disabled={corrigindoMotivos}
              className="border-purple-300 text-purple-700 hover:bg-purple-100 shrink-0"
              data-testid="btn-corrigir-motivos"
            >
              {corrigindoMotivos ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {corrigindoMotivos ? 'Corrigindo...' : 'Corrigir Motivos'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Limpar Dados de Teste */}
      <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">Limpar Dados de Teste</p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  Remove registros de teste (TESTE-*, TEST_*) que migraram do preview
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={limparDadosTeste}
              disabled={limpandoTestes}
              className="border-red-300 text-red-700 hover:bg-red-100 shrink-0"
              data-testid="btn-limpar-testes"
            >
              {limpandoTestes ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {limpandoTestes ? 'Limpando...' : 'Limpar Testes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sincronizar Google Sheets (original) */}
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">Sincronizar Google Sheets</p>
                <p className="text-sm text-green-600/80 dark:text-green-400/80">
                  Envia todos os atendimentos pendentes para o Google Sheets (adiciona novos e atualiza existentes)
                </p>
                {syncResult && (
                  <div className="mt-2 text-xs flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      {syncResult.added} adicionados
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                      {syncResult.updated} atualizados
                    </Badge>
                    {syncResult.errors > 0 && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                        {syncResult.errors} erros
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={sincronizarSheets}
              disabled={sincronizando}
              className="border-green-300 text-green-700 hover:bg-green-100 shrink-0"
              data-testid="btn-sync-sheets"
            >
              {sincronizando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Future Integration Notice */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-400">Integração SharePoint (em breve)</p>
              <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
                Futuramente, os dados do ERP serão sincronizados automaticamente via Microsoft Graph API 
                diretamente do arquivo Excel no SharePoint.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportarPedidos;
