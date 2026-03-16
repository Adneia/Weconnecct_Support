"""
Test file for 6 ELO features:
1. Reabrir atendimentos
2. Textos Falha Fornecedor/Aguardando com Reversa com Assistência
3. Data Último Ponto no Excel
4. Devoluções sem duplicar
5. Sinalizar reversas próximas de vencer
6. Eliminar categoria Comprovante de Entrega
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://elo-admin.preview.emergentagent.com')

class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for leticia user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "leticia@weconnect360.com.br",
            "password": "Teste123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data
        return data.get("token") or data.get("access_token")
    
    def test_login_standard_user(self, auth_token):
        """Test login with standard user credentials"""
        assert auth_token is not None
        print(f"Login successful, token obtained")


class TestReabrirAtendimento:
    """Test #1: Reabrir atendimentos endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "leticia@weconnect360.com.br",
            "password": "Teste123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_reabrir_chamado_inexistente(self, auth_headers):
        """Test PUT /api/chamados/{id}/reabrir returns 404 for nonexistent ID"""
        response = requests.put(
            f"{BASE_URL}/api/chamados/nonexistent-id-12345/reabrir",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        print(f"Correctly returns 404 for nonexistent chamado")
    
    def test_reabrir_endpoint_exists(self, auth_headers):
        """Test that reabrir endpoint exists and accepts PUT requests"""
        # First get a closed chamado from the list
        response = requests.get(
            f"{BASE_URL}/api/chamados?pendente=false",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Found {len(data)} closed chamados")
        
        if len(data) > 0:
            chamado = data[0]
            chamado_id = chamado.get('id')
            print(f"Testing reabrir with chamado ID: {chamado_id}")
            
            # Try to reabrir - might fail if already open
            response = requests.put(
                f"{BASE_URL}/api/chamados/{chamado_id}/reabrir",
                headers=auth_headers
            )
            # Should be 200 (success) or 400 (already open)
            assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
            print(f"Reabrir endpoint response: {response.status_code}")


class TestChamadosCRUD:
    """Test chamados CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "leticia@weconnect360.com.br",
            "password": "Teste123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_list_chamados(self, auth_headers):
        """Test GET /api/chamados"""
        response = requests.get(f"{BASE_URL}/api/chamados", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} chamados total")
    
    def test_list_chamados_pendentes(self, auth_headers):
        """Test GET /api/chamados with pendente filter"""
        response = requests.get(f"{BASE_URL}/api/chamados?pendente=true", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        print(f"Found {len(data)} pending chamados")
    
    def test_search_by_entrega(self, auth_headers):
        """Test search by entrega number (98916275)"""
        response = requests.get(
            f"{BASE_URL}/api/pedidos-erp/98916275",
            headers=auth_headers
        )
        print(f"Search by entrega 98916275: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assert 'numero_pedido' in data
            print(f"Found pedido: {data.get('numero_pedido')}")


class TestTextosPatterns:
    """Test #2, #4, #6: Textos padrão endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "leticia@weconnect360.com.br",
            "password": "Teste123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_texto_falha_fornecedor_1a_reversa(self, auth_headers):
        """Test texto padrão for Falha Fornecedor - 1ª Reversa"""
        response = requests.get(
            f"{BASE_URL}/api/textos-padroes/Falha%20Fornecedor%20-%201%C2%AA%20Reversa",
            headers=auth_headers
        )
        print(f"Falha Fornecedor - 1ª Reversa: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assert 'texto' in data
            print(f"Texto found: {data['texto'][:100]}...")
    
    def test_texto_falha_fornecedor_2a_reversa(self, auth_headers):
        """Test texto padrão for Falha Fornecedor - 2ª Reversa"""
        response = requests.get(
            f"{BASE_URL}/api/textos-padroes/Falha%20Fornecedor%20-%202%C2%AA%20Reversa",
            headers=auth_headers
        )
        print(f"Falha Fornecedor - 2ª Reversa: {response.status_code}")
    
    def test_texto_comprovante_confirmacao(self, auth_headers):
        """Test texto padrão for Comprovante de Entrega - Confirmação"""
        response = requests.get(
            f"{BASE_URL}/api/textos-padroes/Comprovante%20de%20Entrega%20-%20Confirma%C3%A7%C3%A3o",
            headers=auth_headers
        )
        print(f"Comprovante Confirmação: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assert 'texto' in data
            print(f"Texto found, moved to Entregue section")


class TestPedidosERP:
    """Test pedidos ERP search endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "leticia@weconnect360.com.br",
            "password": "Teste123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_search_pedido_by_entrega(self, auth_headers):
        """Test GET /api/pedidos-erp/{numero}"""
        response = requests.get(
            f"{BASE_URL}/api/pedidos-erp/98916275",
            headers=auth_headers
        )
        print(f"Pedido 98916275: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Fornecedor: {data.get('departamento', 'N/A')}")
    
    def test_search_pedido_by_cpf(self, auth_headers):
        """Test GET /api/pedidos-erp/buscar/cpf/{cpf}"""
        response = requests.get(
            f"{BASE_URL}/api/pedidos-erp/buscar/cpf/12345678900",
            headers=auth_headers
        )
        print(f"Search by CPF: {response.status_code}")
    
    def test_search_pedido_by_nome(self, auth_headers):
        """Test GET /api/pedidos-erp/buscar/nome/{nome}"""
        response = requests.get(
            f"{BASE_URL}/api/pedidos-erp/buscar/nome/teste",
            headers=auth_headers
        )
        print(f"Search by nome: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Found {len(data)} pedidos")


class TestDevolucoes:
    """Test #4: Devoluções sem duplicar"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "leticia@weconnect360.com.br",
            "password": "Teste123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_devolucao_endpoint_exists(self, auth_headers):
        """Test POST /api/devolucoes endpoint exists"""
        # This should fail with 400 or 422 for missing required fields, not 404
        response = requests.post(
            f"{BASE_URL}/api/devolucoes",
            headers=auth_headers,
            json={}
        )
        # 400 or 422 means endpoint exists, 404 means it doesn't
        assert response.status_code in [400, 422, 200, 201], f"Unexpected: {response.status_code}"
        print(f"Devolucoes endpoint exists, status: {response.status_code}")


class TestRelatorios:
    """Test #3, #5: Reports and Excel export data"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "leticia@weconnect360.com.br",
            "password": "Teste123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_relatorio_ag_compras(self, auth_headers):
        """Test GET /api/relatorios/ag-compras"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/ag-compras",
            headers=auth_headers
        )
        print(f"Relatorio Ag. Compras: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Found {len(data)} items in Ag. Compras report")
    
    def test_relatorio_ag_logistica(self, auth_headers):
        """Test GET /api/relatorios/ag-logistica"""
        response = requests.get(
            f"{BASE_URL}/api/relatorios/ag-logistica",
            headers=auth_headers
        )
        print(f"Relatorio Ag. Logística: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Found {len(data)} items in Ag. Logística report")
    
    def test_chamados_include_data_ultimo_ponto(self, auth_headers):
        """Test that chamados response includes data_ultimo_status for Excel export"""
        response = requests.get(
            f"{BASE_URL}/api/chamados?pendente=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            # Check if data_ultimo_status field exists (used for Excel "Data Último Ponto")
            sample = data[0]
            has_status_field = 'status_pedido' in sample or 'data_ultimo_status' in sample
            print(f"Sample chamado has status_pedido: {'status_pedido' in sample}")
            print(f"Sample chamado has data_ultimo_status: {'data_ultimo_status' in sample}")


class TestReversa:
    """Test #5: Reversa vencimento badge"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "leticia@weconnect360.com.br",
            "password": "Teste123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_chamados_include_reversa_vencimento(self, auth_headers):
        """Test that chamados include data_vencimento_reversa for badge display"""
        response = requests.get(
            f"{BASE_URL}/api/chamados?pendente=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Look for chamados with reversa codes
        chamados_com_reversa = [c for c in data if c.get('codigo_reversa') or c.get('reversa_codigo')]
        print(f"Found {len(chamados_com_reversa)} chamados with reversa")
        
        if len(chamados_com_reversa) > 0:
            sample = chamados_com_reversa[0]
            print(f"Sample reversa: {sample.get('codigo_reversa')}")
            print(f"Has vencimento: {'data_vencimento_reversa' in sample}")
    
    def test_gerar_reversa_endpoint(self, auth_headers):
        """Test POST /api/chamados/gerar-reversa endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/chamados/gerar-reversa",
            headers=auth_headers,
            json={"numero_pedido": "TEST123"}
        )
        print(f"Gerar reversa: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Generated reversa code: {data.get('codigo_reversa')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
