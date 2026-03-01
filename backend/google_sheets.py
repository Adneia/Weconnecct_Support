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

# Column mapping for Atendimentos sheet (matching EMERGENT_PROMPT_V10 structure)
# A=ID, B=Data, C=Atendente, D=Parceiro, E=Entrega, F=Solicitação, G=Nome, H=CPF,
# I=Categoria, J=Motivo, K=Pendente, L=Status_Cliente, M=DT_Encerramento, N=Reversa,
# O=Anotações, P=Status_Pedido, Q=Nota, R=Chave_Acesso, S=Filial, T=Tempo_Dias
ATENDIMENTO_COLUMNS = [
    'ID',               # A - ATD-2026-XXX
    'Data',             # B - Data de abertura
    'Atendente',        # C - Letícia Martelo ou Adnéia Campos
    'Parceiro',         # D - Canal (CSU, Livelo, LL Loyalty, etc)
    'Entrega',          # E - Código da entrega (numero_pedido)
    'Solicitação',      # F - Número da solicitação
    'Nome',             # G - Nome do cliente
    'CPF',              # H - CPF do cliente
    'Categoria',        # I - Área (Falha Transporte, etc)
    'Motivo',           # J - Motivo específico
    'Pendente',         # K - SIM/NÃO
    'Status_Cliente',   # L - Status final ao encerrar
    'DT_Encerramento',  # M - Data de fechamento
    'Reversa',          # N - Código de reversa
    'Anotações',        # O - Histórico completo
    'Status_Pedido',    # P - Status da entrega
    'Nota',             # Q - Número da NF
    'Chave_Acesso',     # R - Chave da NF-e
    'Filial',           # S - UF
    'Tempo_Dias'        # T - Tempo de resolução
]

# Column mapping for Devoluções sheet
DEVOLUCAO_COLUMNS = [
    'ID_Devolucao',     # A - DEV-2026-XXX
    'ID_Atendimento',   # B - ATD-2026-XXX (link com planilha principal)
    'Data_Entrada_Lista', # C - Quando foi movido para lista
    'Entrega',          # D - Código da entrega
    'CPF',              # E - CPF do cliente
    'Nome',             # F - Nome do cliente
    'Produto',          # G - Nome do produto
    'Codigo_Reversa',   # H - Código da reversa (se houver)
    'Status_Galpao',    # I - AGUARDANDO / RECEBIDO / PROCESSADO
    'Data_Recebimento', # J - Quando chegou no galpão
    'Condicao_Produto', # K - Bom estado / Avariado / Incompleto
    'Proxima_Acao',     # L - REENVIO / ESTORNO / TROCAR
    'Responsavel_Galpao', # M - Quem está tratando
    'Observacoes_Galpao', # N - Notas do galpão
    'Data_Conclusao'    # O - Quando foi finalizado
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
            
            # Parse date
            data_abertura = atendimento.get('data_abertura', '')
            if isinstance(data_abertura, str):
                try:
                    dt = datetime.fromisoformat(data_abertura.replace('Z', '+00:00'))
                    data_formatted = dt.strftime('%d/%m/%Y %H:%M')
                except:
                    data_formatted = data_abertura
            else:
                data_formatted = data_abertura.strftime('%d/%m/%Y %H:%M') if data_abertura else ''
            
            # Prepare row data matching the column structure
            row = [
                atendimento.get('id_atendimento', ''),           # A - ID
                data_formatted,                                   # B - Data
                atendimento.get('atendente', ''),                # C - Atendente
                atendimento.get('parceiro', '') or atendimento.get('canal_vendas', ''),  # D - Parceiro
                atendimento.get('numero_pedido', ''),            # E - Entrega
                atendimento.get('solicitacao', ''),              # F - Solicitação
                atendimento.get('nome_cliente', ''),             # G - Nome
                atendimento.get('cpf_cliente', ''),              # H - CPF
                atendimento.get('categoria', ''),                # I - Categoria
                atendimento.get('motivo', ''),                   # J - Motivo
                'SIM' if atendimento.get('pendente', True) else 'NÃO',  # K - Pendente
                atendimento.get('status_cliente', ''),           # L - Status_Cliente
                '',                                               # M - DT_Encerramento (empty on creation)
                atendimento.get('reversa_codigo', ''),           # N - Reversa
                atendimento.get('anotacoes', ''),                # O - Anotações
                '',                                               # P - Status_Pedido
                '',                                               # Q - Nota
                '',                                               # R - Chave_Acesso
                '',                                               # S - Filial
                '0'                                               # T - Tempo_Dias
            ]
            
            # Add pedido info if available
            if pedido_info:
                row[15] = pedido_info.get('status_pedido', '')   # P - Status_Pedido
                row[16] = pedido_info.get('nota_fiscal', '')     # Q - Nota
                row[17] = pedido_info.get('chave_nota', '')      # R - Chave_Acesso
                row[18] = pedido_info.get('filial', '') or pedido_info.get('uf', '')  # S - Filial
            
            # Append row to sheet
            worksheet.append_row(row, value_input_option='USER_ENTERED')
            logger.info(f"Atendimento {atendimento.get('id_atendimento')} added to Google Sheets")
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
            
            # Find the row with this ID
            cell = worksheet.find(id_atendimento, in_column=1)
            if not cell:
                logger.warning(f"Atendimento {id_atendimento} not found in Google Sheets")
                return False
            
            row_num = cell.row
            
            # Map update fields to column indices
            field_to_col = {
                'atendente': 3,        # C
                'parceiro': 4,         # D
                'solicitacao': 6,      # F
                'categoria': 9,        # I
                'motivo': 10,          # J
                'pendente': 11,        # K
                'status_cliente': 12,  # L
                'data_fechamento': 13, # M
                'reversa_codigo': 14,  # N
                'anotacoes': 15,       # O
            }
            
            # Build batch update
            updates_to_apply = []
            for field, value in updates.items():
                if field in field_to_col:
                    col = field_to_col[field]
                    
                    # Handle special cases
                    if field == 'pendente':
                        value = 'SIM' if value else 'NÃO'
                    elif field == 'data_fechamento' and value:
                        try:
                            dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
                            value = dt.strftime('%d/%m/%Y %H:%M')
                        except:
                            pass
                    
                    updates_to_apply.append({
                        'range': f"{chr(64 + col)}{row_num}",
                        'values': [[value or '']]
                    })
            
            # Calculate tempo_dias if closing
            if 'pendente' in updates and not updates['pendente']:
                # Get data_abertura from sheet
                data_abertura_str = worksheet.cell(row_num, 2).value
                if data_abertura_str:
                    try:
                        data_abertura = datetime.strptime(data_abertura_str, '%d/%m/%Y %H:%M')
                        tempo_dias = (datetime.now() - data_abertura).days
                        updates_to_apply.append({
                            'range': f"T{row_num}",
                            'values': [[str(tempo_dias)]]
                        })
                    except:
                        pass
            
            # Apply batch update
            if updates_to_apply:
                worksheet.batch_update(updates_to_apply)
                logger.info(f"Atendimento {id_atendimento} updated in Google Sheets")
            
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
            worksheet = self.devolucoes_sheet.worksheet("Lista_Devolucao")
            
            # Ensure headers exist
            self._ensure_headers(worksheet, DEVOLUCAO_COLUMNS)
            
            # Prepare row data
            row = [
                devolucao.get('id_devolucao', ''),
                devolucao.get('id_atendimento', ''),
                datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M'),
                devolucao.get('entrega', ''),
                devolucao.get('cpf', ''),
                devolucao.get('nome', ''),
                devolucao.get('produto', ''),
                devolucao.get('codigo_reversa', ''),
                devolucao.get('status_galpao', 'AGUARDANDO'),
                '',  # Data_Recebimento
                '',  # Condicao_Produto
                '',  # Proxima_Acao
                '',  # Responsavel_Galpao
                '',  # Observacoes_Galpao
                ''   # Data_Conclusao
            ]
            
            worksheet.append_row(row, value_input_option='USER_ENTERED')
            logger.info(f"Devolução {devolucao.get('id_devolucao')} added to Google Sheets")
            return True
            
        except gspread.exceptions.WorksheetNotFound:
            logger.error("Worksheet 'Lista_Devolucao' not found in Devoluções spreadsheet")
            return False
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
