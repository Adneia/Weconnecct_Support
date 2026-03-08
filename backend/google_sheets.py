"""
Google Sheets Integration Module for Emergent Atendimentos
Uses Service Account authentication for automatic syncing
"""

import gspread
from google.oauth2.service_account import Credentials
from pathlib import Path
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Spreadsheet IDs from EMERGENT_PROMPT_V10
SPREADSHEET_ATENDIMENTOS_ID = "1cqzY_i1lqvu8sySPFrMtucQfyTo1LYm04ZpxRZNDCBs"
SPREADSHEET_DEVOLUCOES_ID = "1dQbQWvG3Yv7Z6yqjivShK4-N4_pGXjs4x15jRMKVLno"

# Scopes for Google Sheets API
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

# Column mapping for Atendimentos sheet (matching planilha Atendimentos 2026_E)
# Removidas colunas ID e Atendente conforme solicitado
# A=Data, B=Parceiro, C=Entrega, D=Solicitação, E=Nome, F=CPF,
# G=Categoria, H=Motivo, I=Pendente, J=Motivo_Pendencia, K=Verificar, L=Retornar,
# M=DT_Encerramento, N=Reversa, O=Anotações, P=Status_Pedido, Q=Nota, R=Chave_Acesso, S=Filial
ATENDIMENTO_COLUMNS = [
    'Data',             # A - Data de abertura (DD/MM/AAAA)
    'Parceiro',         # B - Canal (CSU, Livelo, LL Loyalty, etc)
    'Entrega',          # C - Código da entrega (numero_pedido)
    'Solicitação',      # D - Número da solicitação
    'Nome',             # E - Nome do cliente
    'CPF',              # F - CPF do cliente
    'Categoria',        # G - Área (Falha Transporte, etc)
    'Motivo',           # H - Motivo específico
    'Pendente',         # I - SIM/NÃO
    'Motivo_Pendencia', # J - Motivo da pendência
    'Verificar',        # K - Verificar Adnéia (SIM/NÃO)
    'Retornar',         # L - Retornar (SIM/NÃO)
    'DT_Encerramento',  # M - Data de fechamento
    'Reversa',          # N - Código de reversa
    'Anotações',        # O - Histórico completo
    'Status_Pedido',    # P - Status da entrega
    'Nota',             # Q - Número da NF
    'Chave_Acesso',     # R - Chave da NF-e
    'Filial'            # S - UF
]

# Column mapping for Devoluções sheet
# Column mapping for Devoluções sheet (planilha Gestão Devoluções 2026_E)
# A=ID_Devolução, B=Pedido_Cliente, C=Data, D=Entrega, E=Parceiro, F=Motivo_Devolucao,
# G=Codigo_Reversa, H=Status_Devolucao, I=Responsavel, J=Atendimento, K=Devolvido_por,
# L=Data_Conclusao, M=Condicao_Produto, N=Proxima_Acao, O=Data_Recebimento,
# P=Responsavel_Galpao, Q=Observacoes_Galpao, R=Data_Conclusao
DEVOLUCAO_COLUMNS = [
    'ID_Devolução',       # A
    'Pedido_Cliente',     # B
    'Data',               # C
    'Entrega',            # D
    'Parceiro',           # E
    'Motivo_Devolucao',   # F
    'Codigo_Reversa',     # G
    'Status_Devolucao',   # H
    'Responsavel',        # I
    'Atendimento',        # J - Aguardando / Estornado / Reenviado
    'Devolvido_por',      # K - Correios ou Transportadora
    'Data_Conclusao',     # L
    'Condicao_Produto',   # M
    'Proxima_Acao',       # N
    'Data_Recebimento',   # O
    'Responsavel_Galpao', # P
    'Observacoes_Galpao', # Q
    'Data_Conclusao'      # R
]


class GoogleSheetsClient:
    """Google Sheets client using Service Account"""
    
    def __init__(self, credentials_path: str = None):
        self.credentials_path = credentials_path or str(Path(__file__).parent / 'credentials.json')
        self.client = None
        self.atendimentos_sheet = None
        self.devolucoes_sheet = None
        self._initialized = False
        
    def _get_credentials(self) -> Credentials:
        """Load credentials from service account file"""
        return Credentials.from_service_account_file(
            self.credentials_path,
            scopes=SCOPES
        )
    
    def initialize(self) -> bool:
        """Initialize the Google Sheets client"""
        try:
            credentials = self._get_credentials()
            self.client = gspread.authorize(credentials)
            
            # Open spreadsheets
            try:
                self.atendimentos_sheet = self.client.open_by_key(SPREADSHEET_ATENDIMENTOS_ID)
                logger.info(f"Connected to Atendimentos spreadsheet: {self.atendimentos_sheet.title}")
            except gspread.SpreadsheetNotFound:
                logger.error(f"Atendimentos spreadsheet not found. Make sure to share it with the service account.")
                return False
            except gspread.exceptions.APIError as e:
                logger.error(f"API error accessing Atendimentos sheet: {e}")
                return False
                
            try:
                self.devolucoes_sheet = self.client.open_by_key(SPREADSHEET_DEVOLUCOES_ID)
                logger.info(f"Connected to Devoluções spreadsheet: {self.devolucoes_sheet.title}")
            except gspread.SpreadsheetNotFound:
                logger.warning(f"Devoluções spreadsheet not found. Devolução features will be limited.")
                self.devolucoes_sheet = None
            except gspread.exceptions.APIError as e:
                logger.warning(f"API error accessing Devoluções sheet: {e}")
                self.devolucoes_sheet = None
            
            self._initialized = True
            return True
            
        except FileNotFoundError:
            logger.error(f"Credentials file not found at {self.credentials_path}")
            return False
        except Exception as e:
            logger.error(f"Error initializing Google Sheets client: {e}")
            return False
    
    def is_initialized(self) -> bool:
        """Check if client is initialized"""
        return self._initialized
    
    def _ensure_headers(self, worksheet, columns: List[str]):
        """Ensure the worksheet has proper headers"""
        try:
            existing = worksheet.row_values(1)
            if not existing or existing != columns:
                worksheet.update('A1', [columns])
                logger.info(f"Headers updated for worksheet: {worksheet.title}")
        except Exception as e:
            logger.warning(f"Could not update headers: {e}")
    
    def add_atendimento(self, atendimento: Dict[str, Any], pedido_info: Dict[str, Any] = None) -> bool:
        """
        Add a new atendimento to the Google Sheet
        
        Args:
            atendimento: Dictionary with atendimento data from MongoDB
            pedido_info: Optional dictionary with pedido ERP data
            
        Returns:
            True if successful, False otherwise
        """
        if not self._initialized:
            if not self.initialize():
                return False
        
        try:
            # Try to get existing worksheet or use first worksheet
            try:
                worksheet = self.atendimentos_sheet.worksheet("Atendimentos")
            except gspread.exceptions.WorksheetNotFound:
                # Try to get the first worksheet
                worksheets = self.atendimentos_sheet.worksheets()
                if worksheets:
                    worksheet = worksheets[0]
                    logger.info(f"Using worksheet: {worksheet.title}")
                else:
                    # Create the worksheet if none exist
                    worksheet = self.atendimentos_sheet.add_worksheet("Atendimentos", rows=1000, cols=20)
                    logger.info("Created new 'Atendimentos' worksheet")
            
            # Ensure headers exist
            self._ensure_headers(worksheet, ATENDIMENTO_COLUMNS)
            
            # Parse date - formato DD/MM/AAAA
            data_abertura = atendimento.get('data_abertura', '')
            if isinstance(data_abertura, str):
                try:
                    dt = datetime.fromisoformat(data_abertura.replace('Z', '+00:00'))
                    data_formatted = dt.strftime('%d/%m/%Y')
                except:
                    data_formatted = data_abertura
            else:
                data_formatted = data_abertura.strftime('%d/%m/%Y') if data_abertura else ''
            
            # Prepare row data matching the NEW column structure (sem ID e Atendente)
            row = [
                data_formatted,                                   # A - Data
                atendimento.get('parceiro', '') or atendimento.get('canal_vendas', ''),  # B - Parceiro
                atendimento.get('numero_pedido', ''),            # C - Entrega
                atendimento.get('solicitacao', ''),              # D - Solicitação
                atendimento.get('nome_cliente', ''),             # E - Nome
                atendimento.get('cpf_cliente', ''),              # F - CPF
                atendimento.get('categoria', ''),                # G - Categoria
                atendimento.get('motivo', ''),                   # H - Motivo
                'SIM' if atendimento.get('pendente', True) else 'NÃO',  # I - Pendente
                atendimento.get('motivo_pendencia', ''),         # J - Motivo_Pendencia
                'SIM' if atendimento.get('verificar_adneia', False) else 'NÃO',  # K - Verificar
                'SIM' if atendimento.get('retornar_chamado', False) else 'NÃO',  # L - Retornar
                '',                                               # M - DT_Encerramento (empty on creation)
                atendimento.get('reversa_codigo', ''),           # N - Reversa
                str(atendimento.get('anotacoes', '') or ''),     # O - Anotações (ensure string)
                '',                                               # P - Status_Pedido
                '',                                               # Q - Nota
                '',                                               # R - Chave_Acesso
                ''                                                # S - Filial
            ]
            
            # Add pedido info if available
            if pedido_info:
                row[15] = pedido_info.get('status_pedido', '')   # P - Status_Pedido
                # Remover .0 da nota fiscal
                nota = str(pedido_info.get('nota_fiscal', ''))
                if nota.endswith('.0'):
                    nota = nota[:-2]
                row[16] = nota                                    # Q - Nota
                row[17] = pedido_info.get('chave_nota', '')      # R - Chave_Acesso
                row[18] = pedido_info.get('filial', '') or pedido_info.get('uf', '')  # S - Filial
            
            # Append row to sheet
            worksheet.append_row(row, value_input_option='USER_ENTERED')
            logger.info(f"Atendimento {atendimento.get('id_atendimento')} added to Google Sheets")
            
            # Se o atendimento foi criado já encerrado, aplicar formatação verde
            if not atendimento.get('pendente', True):
                # Pegar o número da última linha (a que acabou de ser inserida)
                all_values = worksheet.get_all_values()
                last_row = len(all_values)
                self._apply_green_background(worksheet, last_row)
            
            return True
            
        except gspread.exceptions.WorksheetNotFound:
            logger.error("Worksheet 'Atendimentos' not found in spreadsheet")
            return False
        except Exception as e:
            logger.error(f"Error adding atendimento to Google Sheets: {e}")
            return False
    
    def _get_atendimentos_worksheet(self):
        """Get the atendimentos worksheet (uses first sheet if 'Atendimentos' not found)"""
        try:
            return self.atendimentos_sheet.worksheet("Atendimentos")
        except gspread.exceptions.WorksheetNotFound:
            worksheets = self.atendimentos_sheet.worksheets()
            if worksheets:
                return worksheets[0]
            return self.atendimentos_sheet.add_worksheet("Atendimentos", rows=1000, cols=20)
    
    def _get_devolucoes_worksheet(self):
        """Get the devoluções worksheet (uses first sheet if not found)"""
        if not self.devolucoes_sheet:
            logger.error("Devoluções spreadsheet not connected")
            return None
        try:
            return self.devolucoes_sheet.worksheet("Devoluções")
        except gspread.exceptions.WorksheetNotFound:
            worksheets = self.devolucoes_sheet.worksheets()
            if worksheets:
                return worksheets[0]
            return self.devolucoes_sheet.add_worksheet("Devoluções", rows=1000, cols=20)
    
    def _apply_green_background(self, worksheet, row_num: int):
        """Aplica fundo verde claro na linha quando o atendimento é encerrado"""
        try:
            # Verde claro similar ao da planilha (RGB aproximado: 217, 234, 211)
            # Agora são colunas A até S (19 colunas, sem ID e Atendente)
            worksheet.format(f"A{row_num}:S{row_num}", {
                "backgroundColor": {
                    "red": 0.85,
                    "green": 0.92,
                    "blue": 0.83
                }
            })
            logger.info(f"Formatação verde aplicada na linha {row_num}")
        except Exception as e:
            logger.error(f"Erro ao aplicar formatação verde: {e}")
    
    def update_atendimento(self, id_atendimento: str, updates: Dict[str, Any]) -> bool:
        """
        Update an existing atendimento in the Google Sheet
        
        Args:
            id_atendimento: The ATD-XXXX-XXX identifier
            updates: Dictionary with fields to update
            
        Returns:
            True if successful, False otherwise
        """
        if not self._initialized:
            if not self.initialize():
                return False
        
        try:
            worksheet = self._get_atendimentos_worksheet()
            
            # Como removemos a coluna ID, vamos buscar pela Entrega (coluna C, índice 3)
            # Primeiro, tentamos encontrar pelo id_atendimento armazenado em algum lugar
            # Se não encontrar, logamos aviso
            # Por enquanto, vamos manter compatibilidade buscando em todas as células
            cell = None
            try:
                # Tenta buscar na coluna C (Entrega)
                all_values = worksheet.get_all_values()
                for i, row in enumerate(all_values):
                    if len(row) > 2 and row[2] == id_atendimento:  # Coluna C = Entrega
                        cell = type('obj', (object,), {'row': i + 1})()
                        break
            except:
                pass
            
            if not cell:
                logger.warning(f"Atendimento {id_atendimento} not found in Google Sheets")
                return False
            
            row_num = cell.row
            
            # Map update fields to column indices (1-indexed for gspread)
            # Nova estrutura: A=Data, B=Parceiro, C=Entrega, D=Solicitação, E=Nome, F=CPF,
            # G=Categoria, H=Motivo, I=Pendente, J=Motivo_Pendencia, K=Verificar, L=Retornar,
            # M=DT_Encerramento, N=Reversa, O=Anotações, P=Status_Pedido, Q=Nota, R=Chave_Acesso, S=Filial
            field_to_col = {
                'parceiro': 2,            # B
                'solicitacao': 4,         # D
                'categoria': 7,           # G
                'motivo': 8,              # H
                'pendente': 9,            # I
                'motivo_pendencia': 10,   # J
                'verificar_adneia': 11,   # K
                'retornar_chamado': 12,   # L
                'data_fechamento': 13,    # M
                'reversa_codigo': 14,     # N
                'anotacoes': 15,          # O
            }
            
            # Build batch update
            updates_to_apply = []
            for field, value in updates.items():
                if field in field_to_col:
                    col = field_to_col[field]
                    
                    # Handle special cases
                    if field == 'pendente':
                        value = 'SIM' if value else 'NÃO'
                    elif field in ['verificar_adneia', 'retornar_chamado']:
                        value = 'SIM' if value else 'NÃO'
                    elif field == 'data_fechamento' and value:
                        try:
                            dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
                            value = dt.strftime('%d/%m/%Y')
                        except:
                            pass
                    
                    updates_to_apply.append({
                        'range': f"{chr(64 + col)}{row_num}",
                        'values': [[value or '']]
                    })
            
            # Apply batch update
            if updates_to_apply:
                worksheet.batch_update(updates_to_apply)
                logger.info(f"Atendimento {id_atendimento} updated in Google Sheets")
            
            # Aplicar formatação verde se o atendimento foi encerrado
            if 'pendente' in updates and not updates['pendente']:
                self._apply_green_background(worksheet, row_num)
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating atendimento in Google Sheets: {e}")
            return False
    
    def add_devolucao(self, devolucao: Dict[str, Any]) -> bool:
        """
        Add a new devolução to the Devoluções Google Sheet
        
        Args:
            devolucao: Dictionary with devolução data
            
        Returns:
            True if successful, False otherwise
        """
        if not self._initialized:
            if not self.initialize():
                return False
        
        if not self.devolucoes_sheet:
            logger.warning("Devoluções spreadsheet not available")
            return False
        
        try:
            # Usar a primeira aba da planilha
            worksheet = self.devolucoes_sheet.sheet1
            
            # Preparar dados da linha conforme estrutura real da planilha
            # A=ID_Devolucao, B=ID_Atendimento, C=Data_Entrada_Lista, D=Entrega, E=CPF, F=Nome,
            # G=Produto, H=Filial, I=Codigo_Reversa, J=Atendimento, K=Devolvido_por, L=Status_Galpao
            row = [
                devolucao.get('id_devolucao', ''),           # A - ID_Devolucao
                devolucao.get('id_atendimento', ''),         # B - ID_Atendimento
                datetime.now(timezone.utc).strftime('%d/%m/%y'),  # C - Data_Entrada_Lista
                devolucao.get('entrega', ''),                # D - Entrega
                devolucao.get('cpf', ''),                    # E - CPF
                devolucao.get('nome', ''),                   # F - Nome
                devolucao.get('produto', ''),                # G - Produto
                devolucao.get('filial', ''),                 # H - Filial
                devolucao.get('codigo_reversa', ''),         # I - Codigo_Reversa
                devolucao.get('atendimento', 'Aguardando'),  # J - Atendimento (Aguardando/Estornado/Reenviado)
                devolucao.get('devolvido_por', ''),          # K - Devolvido_por (Correios ou Transportadora)
                'AGUARDANDO',                                # L - Status_Galpao
            ]
            
            worksheet.append_row(row, value_input_option='USER_ENTERED')
            logger.info(f"Devolução {devolucao.get('id_devolucao')} added to Google Sheets")
            return True
            
        except Exception as e:
            logger.error(f"Error adding devolução to Google Sheets: {e}")
            return False
    
    def get_all_atendimentos(self) -> List[Dict[str, Any]]:
        """Get all atendimentos from the Google Sheet"""
        if not self._initialized:
            if not self.initialize():
                return []
        
        try:
            worksheet = self._get_atendimentos_worksheet()
            records = worksheet.get_all_records()
            return records
        except Exception as e:
            logger.error(f"Error getting atendimentos from Google Sheets: {e}")
            return []
    
    def find_atendimento_by_id(self, id_atendimento: str) -> Optional[Dict[str, Any]]:
        """Find a specific atendimento by ID"""
        if not self._initialized:
            if not self.initialize():
                return None
        
        try:
            worksheet = self._get_atendimentos_worksheet()
            cell = worksheet.find(id_atendimento, in_column=1)
            if cell:
                row = worksheet.row_values(cell.row)
                # Create dict from row using column headers
                headers = worksheet.row_values(1)
                return dict(zip(headers, row))
            return None
        except Exception as e:
            logger.error(f"Error finding atendimento in Google Sheets: {e}")
            return None
    
    def add_devolucao_row(self, row_data: Dict[str, Any]) -> bool:
        """Add a row to the Devoluções spreadsheet"""
        if not self._initialized:
            if not self.initialize():
                return False
        
        try:
            worksheet = self._get_devolucoes_worksheet()
            if not worksheet:
                logger.error("Could not get devoluções worksheet")
                return False
            
            # Get headers from the first row
            headers = worksheet.row_values(1)
            logger.info(f"Planilha devoluções - Colunas: {headers}")
            
            if not headers:
                logger.error("Planilha de devoluções não tem cabeçalhos")
                return False
            
            # Map row_data keys to the exact column names in the spreadsheet
            # Colunas: ID_Devolucao, ID_Atendimento, Data_Entrada_Lista, Entrega, CPF, Nome, Produto, Filial, 
            #          Codigo_Reversa, Atendimento, Devolvido_por, Status_Galpao, Data_Recebimento, Condicao_Produto, 
            #          Proxima_Acao, Responsavel_Galpao, Observacoes_Galpao, Data_Conclusao
            column_mapping = {
                'ID_Devolucao': row_data.get('id_devolucao', ''),
                'ID_Atendimento': row_data.get('id_atendimento', ''),
                'Data_Entrada_Lista': row_data.get('data_entrada', ''),
                'Entrega': row_data.get('numero_pedido', ''),
                'CPF': row_data.get('cpf_cliente', ''),
                'Nome': row_data.get('nome_cliente', ''),
                'Produto': row_data.get('produto', ''),
                'Filial': row_data.get('filial', ''),
                'Codigo_Reversa': row_data.get('codigo_reversa', ''),
                'Atendimento': row_data.get('atendimento', 'Aguardando'),  # J - Aguardando/Estornado/Reenviado
                'Devolvido_por': row_data.get('devolvido_por', ''),  # K - Correios ou Transportadora
                'Status_Galpao': row_data.get('status_galpao', 'AGUARDANDO'),  # L
                'Data_Recebimento': '',  # Preenchido posteriormente
                'Condicao_Produto': '',  # Preenchido posteriormente
                'Proxima_Acao': 'Aguardando recebimento',
                'Responsavel_Galpao': '',  # Preenchido posteriormente
                'Observacoes_Galpao': row_data.get('motivo', ''),
                'Data_Conclusao': '',  # Preenchido posteriormente
            }
            
            # Prepare row values in the same order as headers
            row_values = []
            for header in headers:
                value = column_mapping.get(header, '')
                row_values.append(str(value) if value else '')
            
            # Append row
            worksheet.append_row(row_values, value_input_option='USER_ENTERED')
            logger.info(f"Devolução added to Google Sheets: Entrega={row_data.get('numero_pedido', 'N/A')}, Nome={row_data.get('nome_cliente', 'N/A')}")
            return True
        except Exception as e:
            logger.error(f"Error adding devolução to Google Sheets: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def get_connection_status(self) -> Dict[str, Any]:
        """Get the connection status of Google Sheets"""
        return {
            "initialized": self._initialized,
            "atendimentos_connected": self.atendimentos_sheet is not None,
            "devolucoes_connected": self.devolucoes_sheet is not None,
            "spreadsheet_atendimentos_id": SPREADSHEET_ATENDIMENTOS_ID,
            "spreadsheet_devolucoes_id": SPREADSHEET_DEVOLUCOES_ID
        }


# Global instance
sheets_client = GoogleSheetsClient()
