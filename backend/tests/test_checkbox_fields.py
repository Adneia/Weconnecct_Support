"""
Backend API Tests for New Checkbox Fields: retornar_chamado and verificar_adneia
Tests: Filter functionality, Create with fields, Update fields
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCheckboxFieldsAPI:
    """Test retornar_chamado and verificar_adneia checkbox fields"""
    
    @pytest.fixture
    def auth_header(self):
        """Get auth header for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        if response.status_code == 200:
            token = response.json()["token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed - skipping")
    
    def test_create_chamado_with_retornar_chamado(self, auth_header):
        """Create chamado with retornar_chamado = true"""
        payload = {
            "numero_pedido": "92512612",
            "categoria": "Acompanhamento",
            "atendente": "Letícia Martelo",
            "retornar_chamado": True,
            "verificar_adneia": False,
            "anotacoes": "TEST_retornar - Testing retornar_chamado field"
        }
        
        response = requests.post(f"{BASE_URL}/api/chamados", json=payload, headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        chamado_id = data["id"]
        
        # Get the chamado and verify field
        get_response = requests.get(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
        assert get_response.status_code == 200
        chamado_data = get_response.json()
        
        assert chamado_data["retornar_chamado"] == True
        assert chamado_data["verificar_adneia"] == False
        
        print(f"✓ Chamado created with retornar_chamado=True")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
    
    def test_create_chamado_with_verificar_adneia(self, auth_header):
        """Create chamado with verificar_adneia = true"""
        payload = {
            "numero_pedido": "92512612",
            "categoria": "Acompanhamento",
            "atendente": "Letícia Martelo",
            "retornar_chamado": False,
            "verificar_adneia": True,
            "anotacoes": "TEST_adneia - Testing verificar_adneia field"
        }
        
        response = requests.post(f"{BASE_URL}/api/chamados", json=payload, headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        chamado_id = data["id"]
        
        # Get the chamado and verify field
        get_response = requests.get(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
        assert get_response.status_code == 200
        chamado_data = get_response.json()
        
        assert chamado_data["verificar_adneia"] == True
        assert chamado_data["retornar_chamado"] == False
        
        print(f"✓ Chamado created with verificar_adneia=True")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
    
    def test_create_chamado_with_both_checkboxes(self, auth_header):
        """Create chamado with both retornar_chamado and verificar_adneia = true"""
        payload = {
            "numero_pedido": "92512612",
            "categoria": "Acompanhamento",
            "atendente": "Letícia Martelo",
            "retornar_chamado": True,
            "verificar_adneia": True,
            "anotacoes": "TEST_both - Testing both checkbox fields"
        }
        
        response = requests.post(f"{BASE_URL}/api/chamados", json=payload, headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        chamado_id = data["id"]
        
        # Get the chamado and verify fields
        get_response = requests.get(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
        assert get_response.status_code == 200
        chamado_data = get_response.json()
        
        assert chamado_data["retornar_chamado"] == True
        assert chamado_data["verificar_adneia"] == True
        
        print(f"✓ Chamado created with both checkboxes=True")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
    
    def test_filter_by_retornar_chamado(self, auth_header):
        """GET /api/chamados?retornar_chamado=true should filter correctly"""
        response = requests.get(f"{BASE_URL}/api/chamados?retornar_chamado=true", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        # All returned chamados should have retornar_chamado = True
        for chamado in data:
            assert chamado.get("retornar_chamado") == True, f"Chamado {chamado['id_atendimento']} has retornar_chamado={chamado.get('retornar_chamado')}"
        
        print(f"✓ Filter retornar_chamado=true returned {len(data)} chamados")
    
    def test_filter_by_verificar_adneia(self, auth_header):
        """GET /api/chamados?verificar_adneia=true should filter correctly"""
        response = requests.get(f"{BASE_URL}/api/chamados?verificar_adneia=true", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        # All returned chamados should have verificar_adneia = True
        for chamado in data:
            assert chamado.get("verificar_adneia") == True, f"Chamado {chamado['id_atendimento']} has verificar_adneia={chamado.get('verificar_adneia')}"
        
        print(f"✓ Filter verificar_adneia=true returned {len(data)} chamados")
    
    def test_update_chamado_checkbox_fields(self, auth_header):
        """PUT /api/chamados/:id should update checkbox fields"""
        # First create a chamado
        create_payload = {
            "numero_pedido": "92512612",
            "categoria": "Acompanhamento",
            "atendente": "Letícia Martelo",
            "retornar_chamado": False,
            "verificar_adneia": False,
            "anotacoes": "TEST_update - Will update checkbox fields"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/chamados", json=create_payload, headers=auth_header)
        assert create_response.status_code == 200
        chamado_id = create_response.json()["id"]
        
        # Update the checkbox fields
        update_payload = {
            "retornar_chamado": True,
            "verificar_adneia": True
        }
        
        update_response = requests.put(f"{BASE_URL}/api/chamados/{chamado_id}", json=update_payload, headers=auth_header)
        assert update_response.status_code == 200
        
        # Verify the update
        get_response = requests.get(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)
        assert get_response.status_code == 200
        chamado_data = get_response.json()
        
        assert chamado_data["retornar_chamado"] == True
        assert chamado_data["verificar_adneia"] == True
        
        print(f"✓ Chamado checkbox fields updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_header)


class TestCPFSearch:
    """Test CPF search functionality"""
    
    @pytest.fixture
    def auth_header(self):
        """Get auth header for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        if response.status_code == 200:
            token = response.json()["token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed - skipping")
    
    def test_search_by_cpf(self, auth_header):
        """GET /api/pedidos-erp/buscar/cpf/:cpf should return pedidos"""
        response = requests.get(f"{BASE_URL}/api/pedidos-erp/buscar/cpf/10856880620", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) > 0, "CPF search should return at least one pedido"
        
        # Verify the expected pedido is returned
        pedido = data[0]
        assert pedido["numero_pedido"] == "92512612"
        assert pedido["nome_cliente"] == "EDSON SOARES DE ARAUJO NETO"
        assert pedido["cpf_cliente"] == "10856880620"
        
        print(f"✓ CPF search returned pedido #{pedido['numero_pedido']} for {pedido['nome_cliente']}")
    
    def test_search_by_cpf_with_formatting(self, auth_header):
        """CPF search should work with formatted CPF (with dots and dashes)"""
        response = requests.get(f"{BASE_URL}/api/pedidos-erp/buscar/cpf/108.568.806-20", headers=auth_header)
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) > 0, "CPF search with formatting should return pedidos"
        print(f"✓ CPF search with formatting returned {len(data)} pedidos")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
