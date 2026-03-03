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
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X, Download } from 'lucide-react';

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

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API_URL}/api/pedidos-erp/import`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data'
          },
          timeout: 300000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      // Verificar se é processamento em background
      if (response.data.status === 'processing' && response.data.import_id) {
        toast.info('Importação iniciada em background. Aguarde...');
        setResult({ 
          success: true, 
          message: `Importação de ${response.data.total_rows} linhas iniciada em background.`,
          isBackground: true,
          importId: response.data.import_id
        });
        
        // Iniciar polling para verificar status
        pollImportStatus(response.data.import_id);
      } else {
        setResult({ success: true, message: response.data.message });
        toast.success('Importação concluída!');
        setUploading(false);
      }
    } catch (error) {
      console.error('Erro de importação:', error);
      const errorMessage = error.response?.data?.detail 
        || error.message 
        || 'Erro ao importar arquivo';
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
            message: `Importação concluída: ${data.imported} novos, ${data.updated} atualizados, ${data.skipped_old} ignorados (>6 meses), ${data.errors} erros`
          });
          toast.success('Importação concluída!');
          setUploading(false);
          return true; // Para o polling
        } else {
          // Ainda processando - atualizar progresso
          const processed = data.imported + data.updated + data.skipped_old + data.errors;
          setResult({ 
            success: true, 
            message: `Processando... ${processed} de ${data.total_rows} linhas (${data.imported} novos, ${data.updated} atualizados)`,
            isBackground: true
          });
          return false; // Continua polling
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
        return false;
      }
    };
    
    // Verificar a cada 3 segundos
    const interval = setInterval(async () => {
      const completed = await checkStatus();
      if (completed) {
        clearInterval(interval);
      }
    }, 3000);
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
          <CardTitle className="text-lg">Instruções - Tabelão WeConnect</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
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

      {/* Result */}
      {result && (
        <Card className={result.success ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'} data-testid="import-result">
          <CardContent className="p-6 flex items-center gap-4">
            {result.success ? (
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            ) : (
              <AlertCircle className="h-8 w-8 text-red-600" />
            )}
            <div>
              <p className={`font-medium ${result.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {result.success ? 'Importação Concluída' : 'Erro na Importação'}
              </p>
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

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
