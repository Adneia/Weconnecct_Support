"""
Backend API Tests for New Features: Acompanhamento Category, Reversa Fields, codigo_fornecedor
Tests: CPF search with codigo_fornecedor, Acompanhamento textos, Transportadora detection
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuthentication:
    """Test authentication for test user"""
    
    @pytest.fixture(scope="class")
    def auth_header(self):
        """Get auth header for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@emergent.com",
            "password": "test123"
        })
        if response.status_code == 200:
            token = response.json()["token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed - skipping")


class TestCodigoFornecedor:
    """Tests for codigo_fornecedor field in pedido search"""
    
    @pytest.fixture
    def auth_header(self):
        """Get auth header for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@emergent.com",
            "password": "test123"
        })
        if response.status_code == 200:
            token = response.json()["token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed - skipping")
    
    def test_cpf_search_returns_codigo_fornecedor(self, auth_header):
        """CPF search should return codigo_fornecedor field"""
        # CPF: 10856880620 is the test CPF provided
        response = requests.get(f"{BASE_URL}/api/pedidos-erp/buscar/cpf/10856880620", headers=auth_header)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0, "Should find at least one pedido for this CPF"
        
        pedido = data[0]
        # Verify codigo_fornecedor is present and has expected value
        assert "codigo_fornecedor" in pedido, "codigo_fornecedor field should be present"
        assert pedido["codigo_fornecedor"] == "00A0000C0L", f"Expected codigo_fornecedor='00A0000C0L', got '{pedido.get('codigo_fornecedor')}'"
        
        print(f"✓ CPF search returned codigo_fornecedor: {pedido['codigo_fornecedor']}")
    
    def test_cpf_search_returns_transportadora(self, auth_header):
        """CPF search should return transportadora for auto-detection"""
        response = requests.get(f"{BASE_URL}/api/pedidos-erp/buscar/cpf/10856880620", headers=auth_header)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        pedido = data[0]
        assert "transportadora" in pedido
        assert pedido["transportadora"] == "TEX COURIER LTDA", f"Expected 'TEX COURIER LTDA', got '{pedido.get('transportadora')}'"
        
        print(f"✓ Transportadora: {pedido['transportadora']} (should detect as Total Express)")


class TestAcompanhamentoCategory:
    """Tests for 'Acompanhamento' category replacing 'Dúvida'"""
    
    @pytest.fixture
    def auth_header(self):
        """Get auth header for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@emergent.com",
            "password": "test123"
        })
        if response.status_code == 200:
            token = response.json()["token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed - skipping")
    
    def test_acompanhamento_texto_padrao_exists(self, auth_header):
        """Acompanhamento category should have texto padrão"""
        response = requests.get(f"{BASE_URL}/api/textos-padroes/Acompanhamento", headers=auth_header)
        assert response.status_code == 200
        
        data = response.json()
        assert data["categoria"] == "Acompanhamento"
        assert "texto" in data
        assert len(data["texto"]) > 0
        
        print(f"✓ Acompanhamento texto padrão exists")
    
    def test_acompanhamento_entregue_possivel_contestacao(self, auth_header):
        """Acompanhamento - Entregue Possível Contestação text should exist"""
        response = requests.get(
            f"{BASE_URL}/api/textos-padroes/Acompanhamento%20-%20Entregue%20Poss%C3%ADvel%20Contesta%C3%A7%C3%A3o", 
            headers=auth_header
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "[DATA_ENTREGA]" in data["texto"], "Text should have [DATA_ENTREGA] placeholder"
        assert "10 dias corridos" in data["texto"], "Text should mention 10 days deadline"
        
        print(f"✓ 'Entregue - Possível Contestação' text template found")
    
    def test_acompanhamento_contestacao_expirada(self, auth_header):
        """Acompanhamento - Entregue Contestação Expirada text should exist"""
        response = requests.get(
            f"{BASE_URL}/api/textos-padroes/Acompanhamento%20-%20Entregue%20Contesta%C3%A7%C3%A3o%20Expirada", 
            headers=auth_header
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "expirado" in data["texto"].lower(), "Text should mention expiration"
        
        print(f"✓ 'Entregue - Contestação Expirada' text template found")
    
    def test_acompanhamento_sem_comprovante(self, auth_header):
        """Acompanhamento - Sem Comprovante Entrega text should exist"""
        response = requests.get(
            f"{BASE_URL}/api/textos-padroes/Acompanhamento%20-%20Sem%20Comprovante%20Entrega", 
            headers=auth_header
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "comprovante" in data["texto"].lower()
        
        print(f"✓ 'Sem Comprovante' text template found")
    
    def test_acompanhamento_em_processo_total_express(self, auth_header):
        """Acompanhamento - Em Processo Total Express text should exist"""
        response = requests.get(
            f"{BASE_URL}/api/textos-padroes/Acompanhamento%20-%20Em%20Processo%20Total%20Express", 
            headers=auth_header
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "totalconecta.totalexpress.com.br" in data["texto"], "Should have Total Express tracking URL"
        
        print(f"✓ 'Em Processo - Total Express' text template found")
    
    def test_list_textos_includes_acompanhamento(self, auth_header):
        """List textos padrões should include Acompanhamento category"""
        response = requests.get(f"{BASE_URL}/api/textos-padroes", headers=auth_header)
        assert response.status_code == 200
        
        data = response.json()
        assert "categorias" in data
        assert "Acompanhamento" in data["categorias"], "'Acompanhamento' should be in categorias list"
        
        # Check that Acompanhamento textos are present
        textos = data.get("textos", {})
        acompanhamento_textos = [k for k in textos.keys() if "Acompanhamento" in k]
        assert len(acompanhamento_textos) >= 4, f"Should have at least 4 Acompanhamento texts, found {len(acompanhamento_textos)}"
        
        print(f"✓ Found {len(acompanhamento_textos)} Acompanhamento text templates")


class TestChamadoWithAcompanhamento:
    """Test creating chamado with Acompanhamento category"""
    
    @pytest.fixture
    def auth_header(self):
        """Get auth header for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@emergent.com",
            "password": "test123"
        })
        if response.status_code == 200:
            token = response.json()["token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed - skipping")
    
    def test_create_chamado_with_acompanhamento(self, auth_header):
        """Should be able to create chamado with Acompanhamento category"""
        payload = {
            "numero_pedido": "92512612",
            "categoria": "Acompanhamento",
            "atendente": "Letícia Martelo",
            "anotacoes": "TEST_acompanhamento - Teste criação com categoria Acompanhamento"
        }
        
        response = requests.post(f"{BASE_URL}/api/chamados", json=payload, headers=auth_header)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "id_atendimento" in data
        assert data["id_atendimento"].startswith("ATD-")
        
        chamado_id = data["id"]
        print(f"✓ Created chamado {data['id_atendimento']} with Acompanhamento category")
        
        # Verify the chamado was created with correct category
        get_response = requests.get(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
        assert get_response.status_code == 200
        chamado = get_response.json()
        assert chamado["categoria"] == "Acompanhamento"
        
        print(f"✓ Verified chamado has categoria='Acompanhamento'")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
        assert delete_response.status_code == 200
        print(f"✓ Cleaned up test chamado")


class TestGoogleSheetsStatus:
    """Test Google Sheets integration status"""
    
    @pytest.fixture
    def auth_header(self):
        """Get auth header for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@emergent.com",
            "password": "test123"
        })
        if response.status_code == 200:
            token = response.json()["token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed - skipping")
    
    def test_google_sheets_connection_status(self, auth_header):
        """Google Sheets should be connected"""
        response = requests.get(f"{BASE_URL}/api/google-sheets/status", headers=auth_header)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("initialized") == True, "Google Sheets should be initialized"
        assert data.get("atendimentos_connected") == True, "Atendimentos sheet should be connected"
        
        print(f"✓ Google Sheets status: initialized={data['initialized']}, connected={data['atendimentos_connected']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
