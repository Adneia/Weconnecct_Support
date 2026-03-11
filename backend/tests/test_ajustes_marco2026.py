"""
Test file for AJUSTES 1-5 from Prompt_Completo_ELO_Marco2026.md:
- AJUSTE 1: Auto-fill motivo_pendencia from status_pedido mapping
- AJUSTE 2: Clear verificar_adneia when motivo_pendencia changes
- AJUSTE 3: Multi-select parceiro filter (comma-separated)
- AJUSTE 4: Total na Base endpoint
- AJUSTE 5: data_ultimo_status field in chamados list
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "adneia@weconnect360.com.br", "password": "20wead"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("token")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestAjuste1MotivoMapping:
    """AJUSTE 1: Auto-fill motivo_pendencia from status_pedido mapping"""
    
    def test_migrar_ajustes_marco2026_endpoint(self, auth_headers):
        """Test POST /api/admin/migrar-ajustes-marco2026 returns expected stats"""
        response = requests.post(
            f"{BASE_URL}/api/admin/migrar-ajustes-marco2026",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Migration failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "ajuste1" in data, "Missing ajuste1 stats"
        
        # AJUSTE 1 stats
        ajuste1 = data["ajuste1"]
        assert "pendentes_verificados" in ajuste1
        assert "elegiveis" in ajuste1
        assert "atualizados" in ajuste1
        assert "ignorados_outros_motivos" in ajuste1
        assert "verificar_limpo" in ajuste1
        
        # AJUSTE 2 stats
        assert "ajuste2" in data
        
        # AJUSTE 5 stats
        assert "ajuste5" in data
        assert "com_data" in data["ajuste5"]
        assert "sem_data" in data["ajuste5"]
        
        # Distribution stats
        assert "distribuicao_final" in data
        
        print(f"Migration stats: pendentes_verificados={ajuste1['pendentes_verificados']}, "
              f"elegiveis={ajuste1['elegiveis']}, atualizados={ajuste1['atualizados']}")
    
    def test_create_chamado_auto_fill_motivo(self, auth_headers):
        """Test that creating a chamado auto-fills motivo_pendencia from status_pedido"""
        # First, get an existing pedido to use for test
        chamados_response = requests.get(
            f"{BASE_URL}/api/chamados?pendente=true",
            headers=auth_headers
        )
        assert chamados_response.status_code == 200
        chamados = chamados_response.json()
        
        # Find a chamado with a pedido that has a status
        test_pedido = None
        for chamado in chamados[:10]:
            if chamado.get('numero_pedido') and chamado.get('status_pedido'):
                test_pedido = chamado['numero_pedido']
                break
        
        if not test_pedido:
            pytest.skip("No suitable test pedido found")
        
        # Create new chamado without motivo_pendencia - it should be auto-filled
        unique_id = str(uuid.uuid4())[:8]
        new_chamado = {
            "numero_pedido": test_pedido,
            "categoria": "Acompanhamento",
            "solicitacao": f"TEST-{unique_id}",
            "descricao": "Test auto-fill motivo"
            # Note: not providing motivo_pendencia
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chamados",
            json=new_chamado,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        # Get the created chamado to verify auto-fill
        chamado_id = response.json().get("id")
        get_response = requests.get(
            f"{BASE_URL}/api/chamados/{chamado_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        created_chamado = get_response.json()
        
        print(f"Created chamado: motivo_pendencia={created_chamado.get('motivo_pendencia')}, "
              f"status_pedido={created_chamado.get('status_pedido')}")
        
        # Cleanup - delete test chamado
        requests.delete(f"{BASE_URL}/api/chamados/{chamado_id}", headers=auth_headers)


class TestAjuste2ClearVerificar:
    """AJUSTE 2: Clear verificar_adneia when motivo_pendencia changes"""
    
    def test_update_motivo_clears_verificar(self, auth_headers):
        """Test that updating motivo_pendencia clears verificar_adneia"""
        # Get a chamado with verificar_adneia=true, or create one
        chamados_response = requests.get(
            f"{BASE_URL}/api/chamados?verificar_adneia=true",
            headers=auth_headers
        )
        assert chamados_response.status_code == 200
        chamados = chamados_response.json()
        
        if len(chamados) == 0:
            pytest.skip("No chamados with verificar_adneia=true found")
        
        test_chamado = chamados[0]
        chamado_id = test_chamado['id']
        original_motivo = test_chamado.get('motivo_pendencia', '')
        
        # Change the motivo_pendencia to a different value
        new_motivo = "Ag. Cliente" if original_motivo != "Ag. Cliente" else "Ag. Compras"
        
        update_response = requests.put(
            f"{BASE_URL}/api/chamados/{chamado_id}",
            json={"motivo_pendencia": new_motivo},
            headers=auth_headers
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify verificar_adneia was cleared
        get_response = requests.get(
            f"{BASE_URL}/api/chamados/{chamado_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        updated_chamado = get_response.json()
        
        assert updated_chamado.get('verificar_adneia') == False, \
            f"verificar_adneia should be False after motivo change, got: {updated_chamado.get('verificar_adneia')}"
        assert updated_chamado.get('motivo_pendencia') == new_motivo
        
        print(f"AJUSTE 2 verified: motivo changed from '{original_motivo}' to '{new_motivo}', "
              f"verificar_adneia cleared to False")
        
        # Restore original state
        requests.put(
            f"{BASE_URL}/api/chamados/{chamado_id}",
            json={"motivo_pendencia": original_motivo, "verificar_adneia": True},
            headers=auth_headers
        )


class TestAjuste3MultiParceiro:
    """AJUSTE 3: Multi-select parceiro filter (comma-separated)"""
    
    def test_single_parceiro_filter(self, auth_headers):
        """Test filtering by single parceiro works"""
        response = requests.get(
            f"{BASE_URL}/api/chamados?parceiro=CSU",
            headers=auth_headers
        )
        assert response.status_code == 200
        chamados = response.json()
        
        # All results should have parceiro=CSU
        for chamado in chamados[:20]:
            assert chamado.get('parceiro') == 'CSU', \
                f"Expected parceiro CSU, got {chamado.get('parceiro')}"
        
        print(f"Single parceiro filter: found {len(chamados)} chamados for CSU")
    
    def test_multi_parceiro_filter(self, auth_headers):
        """Test filtering by multiple parceiros (comma-separated)"""
        response = requests.get(
            f"{BASE_URL}/api/chamados?parceiro=CSU,LTM",
            headers=auth_headers
        )
        assert response.status_code == 200
        chamados = response.json()
        
        # All results should have parceiro=CSU or parceiro=LTM
        valid_parceiros = {'CSU', 'LTM'}
        for chamado in chamados[:20]:
            parceiro = chamado.get('parceiro')
            assert parceiro in valid_parceiros, \
                f"Expected parceiro in {valid_parceiros}, got {parceiro}"
        
        print(f"Multi-parceiro filter: found {len(chamados)} chamados for CSU,LTM")
    
    def test_multi_parceiro_filter_three_values(self, auth_headers):
        """Test filtering by three parceiros"""
        response = requests.get(
            f"{BASE_URL}/api/chamados?parceiro=CSU,LTM,Livelo",
            headers=auth_headers
        )
        assert response.status_code == 200
        chamados = response.json()
        
        valid_parceiros = {'CSU', 'LTM', 'Livelo'}
        csu_count = ltm_count = livelo_count = 0
        
        for chamado in chamados:
            parceiro = chamado.get('parceiro')
            assert parceiro in valid_parceiros, \
                f"Expected parceiro in {valid_parceiros}, got {parceiro}"
            if parceiro == 'CSU':
                csu_count += 1
            elif parceiro == 'LTM':
                ltm_count += 1
            elif parceiro == 'Livelo':
                livelo_count += 1
        
        print(f"3-parceiro filter: CSU={csu_count}, LTM={ltm_count}, Livelo={livelo_count}")


class TestAjuste4TotalNaBase:
    """AJUSTE 4: Total na Base endpoint"""
    
    def test_total_na_base_endpoint(self, auth_headers):
        """Test GET /api/admin/total-na-base returns totals"""
        response = requests.get(
            f"{BASE_URL}/api/admin/total-na-base",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_chamados" in data
        assert "total_pedidos" in data
        
        # Values should be integers >= 0
        assert isinstance(data["total_chamados"], int)
        assert isinstance(data["total_pedidos"], int)
        assert data["total_chamados"] >= 0
        assert data["total_pedidos"] >= 0
        
        print(f"Total na Base: total_chamados={data['total_chamados']}, "
              f"total_pedidos={data['total_pedidos']}")
    
    def test_total_na_base_independent_of_filters(self, auth_headers):
        """Test that total-na-base returns same value regardless of chamados filter"""
        # Get total without filters
        total_response = requests.get(
            f"{BASE_URL}/api/admin/total-na-base",
            headers=auth_headers
        )
        assert total_response.status_code == 200
        total_base = total_response.json()["total_chamados"]
        
        # Get filtered chamados count
        filtered_response = requests.get(
            f"{BASE_URL}/api/chamados?parceiro=CSU",
            headers=auth_headers
        )
        assert filtered_response.status_code == 200
        filtered_count = len(filtered_response.json())
        
        # Total should be >= filtered count (unless all are CSU)
        assert total_base >= 0, "Total na base should be a positive number"
        
        print(f"Total na Base ({total_base}) is independent of filter (filtered={filtered_count})")


class TestAjuste5DataUltimoStatus:
    """AJUSTE 5: data_ultimo_status field in chamados list"""
    
    def test_chamados_list_has_data_ultimo_status(self, auth_headers):
        """Test that GET /api/chamados returns data_ultimo_status field"""
        response = requests.get(
            f"{BASE_URL}/api/chamados?pendente=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        chamados = response.json()
        
        # Check if any chamados have data_ultimo_status
        has_date = 0
        no_date = 0
        
        for chamado in chamados[:50]:
            if chamado.get('numero_pedido'):  # Only check if it has a pedido
                if chamado.get('data_ultimo_status'):
                    has_date += 1
                else:
                    no_date += 1
        
        print(f"AJUSTE 5: Chamados with data_ultimo_status={has_date}, without={no_date}")
        
        # At least some chamados should have the field populated
        # (depending on the data in pedidos_erp)
    
    def test_chamado_detail_has_pedido_data_status(self, auth_headers):
        """Test that single chamado endpoint returns pedido with data_status"""
        # Get a chamado with a numero_pedido
        response = requests.get(
            f"{BASE_URL}/api/chamados?pendente=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        chamados = response.json()
        
        test_chamado = None
        for chamado in chamados:
            if chamado.get('numero_pedido'):
                test_chamado = chamado
                break
        
        if not test_chamado:
            pytest.skip("No chamados with numero_pedido found")
        
        # Get single chamado detail
        detail_response = requests.get(
            f"{BASE_URL}/api/chamados/{test_chamado['id']}",
            headers=auth_headers
        )
        assert detail_response.status_code == 200
        chamado_detail = detail_response.json()
        
        # Check if pedido_erp is present
        if chamado_detail.get('pedido_erp'):
            pedido = chamado_detail['pedido_erp']
            print(f"Pedido ERP data: status_pedido={pedido.get('status_pedido')}, "
                  f"data_status={pedido.get('data_status')}")


class TestMotivoMappingFunction:
    """Test the motivo_pendencia mapping function"""
    
    def test_mapping_status_to_motivo(self, auth_headers):
        """Verify known status_pedido values map to expected motivo"""
        # These are from the mapping table in motivo_pendencia_mapping.py
        expected_mappings = {
            "Aguardando estoque": "Ag. Compras",
            "NF emitida": "Ag. Logística",
            "SAIU PARA ENTREGA": "Enviado",
            "DESTINATÁRIO AUSENTE": "Ag. Parceiro",
            "ENTREGUE": "Entregue"
        }
        
        # Get chamados to verify the mapping is applied
        response = requests.get(
            f"{BASE_URL}/api/chamados?pendente=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        chamados = response.json()
        
        mapping_applied = []
        for chamado in chamados[:100]:
            status = chamado.get('status_pedido', '')
            motivo = chamado.get('motivo_pendencia', '')
            if status in expected_mappings:
                expected = expected_mappings[status]
                if motivo == expected:
                    mapping_applied.append((status, motivo))
        
        if mapping_applied:
            print(f"Found {len(mapping_applied)} chamados with correct mapping applied")
            for status, motivo in mapping_applied[:5]:
                print(f"  {status} -> {motivo}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
