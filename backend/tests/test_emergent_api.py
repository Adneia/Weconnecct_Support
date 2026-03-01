"""
Backend API Tests for Emergent Atendimentos System
Tests: Authentication, Google Sheets Integration, Chamados CRUD, Pedido Search
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAPIRoot:
    """Test API root endpoint"""
    
    def test_api_root(self):
        """API root should return welcome message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "WeConnect Support API" in data["message"]
        print("✓ API root endpoint working")


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_with_valid_credentials(self):
        """Login should work with test credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@emergent.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@emergent.com"
        print("✓ Login with valid credentials successful")
    
    def test_login_with_invalid_credentials(self):
        """Login should fail with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Login rejected invalid credentials")
    
    def test_protected_endpoint_without_token(self):
        """Protected endpoint should reject requests without token"""
        response = requests.get(f"{BASE_URL}/api/chamados")
        assert response.status_code in [401, 403]
        print("✓ Protected endpoint requires authentication")


class TestGoogleSheetsIntegration:
    """Test Google Sheets integration endpoints"""
    
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
    
    def test_google_sheets_status(self, auth_header):
        """GET /api/google-sheets/status should return connection status"""
        response = requests.get(f"{BASE_URL}/api/google-sheets/status", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "initialized" in data
        assert "atendimentos_connected" in data
        assert "devolucoes_connected" in data
        assert "spreadsheet_atendimentos_id" in data
        
        # Verify actual connection status (should be True)
        assert data["initialized"] == True, "Google Sheets should be initialized"
        assert data["atendimentos_connected"] == True, "Atendimentos sheet should be connected"
        
        print(f"✓ Google Sheets status: initialized={data['initialized']}, atendimentos={data['atendimentos_connected']}")


class TestPedidoSearch:
    """Test pedido search functionality"""
    
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
    
    def test_search_pedido_by_entrega(self, auth_header):
        """Search pedido by numero de Entrega should return pedido data"""
        # Using the test pedido number from CPF 10856880620
        response = requests.get(f"{BASE_URL}/api/pedidos-erp/92512612", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response contains expected fields
        assert data["numero_pedido"] == "92512612"
        assert "nome_cliente" in data
        assert "cpf_cliente" in data
        assert "status_pedido" in data
        assert "produto" in data
        assert "transportadora" in data
        
        print(f"✓ Pedido search returned: {data['nome_cliente']} - {data['produto']}")
    
    def test_search_pedido_not_found(self, auth_header):
        """Search non-existent pedido should return 404"""
        response = requests.get(f"{BASE_URL}/api/pedidos-erp/999999999", headers=auth_header)
        assert response.status_code == 404
        print("✓ Non-existent pedido returns 404")


class TestChamadosCRUD:
    """Test Chamados (Atendimentos) CRUD operations"""
    
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
    
    def test_create_chamado_and_verify_google_sheets_sync(self, auth_header):
        """POST /api/chamados should create atendimento with Google Sheets sync queued"""
        payload = {
            "numero_pedido": "117844750",
            "categoria": "Falha Transporte",
            "atendente": "Letícia Martelo",
            "anotacoes": "TEST_chamado - Teste automatizado de criação"
        }
        
        response = requests.post(f"{BASE_URL}/api/chamados", json=payload, headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "id_atendimento" in data
        assert data["id_atendimento"].startswith("ATD-2026-")
        
        # Verify Google Sheets sync is queued
        assert data["google_sheets_sync"] == "queued", "Google Sheets sync should be queued"
        
        print(f"✓ Chamado created: {data['id_atendimento']} - Google Sheets sync: {data['google_sheets_sync']}")
        
        # Cleanup - delete the test chamado
        chamado_id = data["id"]
        delete_response = requests.delete(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
        assert delete_response.status_code == 200
        print(f"✓ Test chamado {data['id_atendimento']} cleaned up")
    
    def test_list_chamados(self, auth_header):
        """GET /api/chamados should list all atendimentos"""
        response = requests.get(f"{BASE_URL}/api/chamados", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        # If there are chamados, verify structure
        if len(data) > 0:
            chamado = data[0]
            assert "id" in chamado
            assert "id_atendimento" in chamado
            assert "numero_pedido" in chamado
            assert "categoria" in chamado
            assert "pendente" in chamado
            assert "dias_aberto" in chamado
        
        print(f"✓ List chamados returned {len(data)} atendimentos")
    
    def test_get_chamado_by_id(self, auth_header):
        """GET /api/chamados/:id should return chamado details"""
        # First list chamados to get an ID
        list_response = requests.get(f"{BASE_URL}/api/chamados", headers=auth_header)
        chamados = list_response.json()
        
        if len(chamados) == 0:
            pytest.skip("No chamados available to test")
        
        chamado_id = chamados[0]["id"]
        response = requests.get(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == chamado_id
        print(f"✓ Get chamado {data['id_atendimento']} successful")
    
    def test_create_chamado_without_numero_pedido(self, auth_header):
        """POST /api/chamados without numero_pedido should return 400"""
        payload = {
            "numero_pedido": "",
            "categoria": "Falha Transporte"
        }
        
        response = requests.post(f"{BASE_URL}/api/chamados", json=payload, headers=auth_header)
        assert response.status_code == 400
        print("✓ Create chamado without numero_pedido rejected")


class TestDashboard:
    """Test Dashboard statistics endpoint"""
    
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
    
    def test_dashboard_stats(self, auth_header):
        """GET /api/dashboard/stats should return statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_pendentes" in data
        assert "total_resolvidos" in data
        assert "total_pedidos_base" in data
        assert "por_categoria" in data
        assert "por_atendente" in data
        assert "ultimos_7_dias" in data
        
        print(f"✓ Dashboard stats: {data['total_pendentes']} pendentes, {data['total_resolvidos']} resolvidos")


class TestTextoPadroes:
    """Test standard text templates"""
    
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
    
    def test_get_texto_padrao(self, auth_header):
        """GET /api/textos-padroes/:categoria should return template text"""
        response = requests.get(f"{BASE_URL}/api/textos-padroes/Falha%20Transporte", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        assert "categoria" in data
        assert "texto" in data
        assert data["categoria"] == "Falha Transporte"
        assert len(data["texto"]) > 0
        
        print(f"✓ Got texto padrão for Falha Transporte")
    
    def test_list_textos_padroes(self, auth_header):
        """GET /api/textos-padroes should list all templates"""
        response = requests.get(f"{BASE_URL}/api/textos-padroes", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        assert "categorias" in data
        assert "textos" in data
        assert len(data["categorias"]) > 0
        
        print(f"✓ Listed {len(data['categorias'])} categorias with templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
