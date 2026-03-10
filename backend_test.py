#!/usr/bin/env python3

import requests
import sys
import json
import io
from datetime import datetime

class WeConnectAPITester:
    def __init__(self, base_url="https://elo-weconnect.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'chamados': [],
            'reversas': [],
            'historicos': []
        }

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    headers.pop('Content-Type', None)
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json().get('detail', 'No detail')
                    self.log(f"   Error: {error_detail}")
                except:
                    self.log(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {}

    def test_auth_flow(self):
        """Test authentication endpoints"""
        self.log("\n=== TESTING AUTHENTICATION ===")
        
        # Test registration
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@weconnect.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": "teste123",
                "name": "Test User"
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            self.log(f"   Registered user: {response['user']['name']}")
        else:
            # Try login with provided credentials
            success, response = self.run_test(
                "User Login",
                "POST",
                "auth/login",
                200,
                data={
                    "email": "atendente@weconnect.com",
                    "password": "teste123"
                }
            )
            
            if success and 'token' in response:
                self.token = response['token']
                self.user_id = response['user']['id']
                self.log(f"   Logged in user: {response['user']['name']}")
            else:
                self.log("❌ Authentication failed - cannot continue tests")
                return False

        # Test get current user
        self.run_test("Get Current User", "GET", "auth/me", 200)
        
        # Test list users
        self.run_test("List Users", "GET", "users", 200)
        
        return True

    def test_chamados_crud(self):
        """Test chamados CRUD operations"""
        self.log("\n=== TESTING CHAMADOS CRUD ===")
        
        # Create chamado
        chamado_data = {
            "numero_pedido": f"TEST{datetime.now().strftime('%H%M%S')}",
            "canal_origem": "Email",
            "categoria": "Acompanhamento",
            "sintese_problema": "Teste de problema para validação do sistema",
            "prioridade": "Media",
            "status_chamado": "Aguardando",
            "precisa_reversa": False
        }
        
        success, response = self.run_test(
            "Create Chamado",
            "POST",
            "chamados",
            200,
            data=chamado_data
        )
        
        if success and 'id' in response:
            chamado_id = response['id']
            self.created_resources['chamados'].append(chamado_id)
            self.log(f"   Created chamado: {chamado_id}")
            
            # Get chamado details
            success, chamado_details = self.run_test(
                "Get Chamado Details",
                "GET",
                f"chamados/{chamado_id}",
                200
            )
            
            # Update chamado
            update_data = {
                "prioridade": "Alta",
                "status_atendimento": "Aberto",
                "responsavel_id": self.user_id
            }
            
            self.run_test(
                "Update Chamado",
                "PUT",
                f"chamados/{chamado_id}",
                200,
                data=update_data
            )
            
            return chamado_id
        else:
            self.log("❌ Failed to create chamado")
            return None

        # List chamados
        self.run_test("List Chamados", "GET", "chamados", 200)
        
        # List with filters
        self.run_test("List Chamados with Filters", "GET", "chamados?status_atendimento=Aberto&categoria=Acompanhamento", 200)

    def test_historico(self, chamado_id):
        """Test historico operations"""
        if not chamado_id:
            return
            
        self.log("\n=== TESTING HISTORICO ===")
        
        # Create historico entry
        historico_data = {
            "chamado_id": chamado_id,
            "tipo_acao": "Contato com Cliente",
            "descricao": "Cliente contatado via email para esclarecimentos"
        }
        
        success, response = self.run_test(
            "Create Historico",
            "POST",
            "historico",
            200,
            data=historico_data
        )
        
        if success and 'id' in response:
            self.created_resources['historicos'].append(response['id'])
        
        # Get historico for chamado
        self.run_test(
            "Get Chamado Historico",
            "GET",
            f"historico/{chamado_id}",
            200
        )

    def test_reversas(self, chamado_id):
        """Test reversas operations"""
        if not chamado_id:
            return
            
        self.log("\n=== TESTING REVERSAS ===")
        
        # Create reversa
        reversa_data = {
            "chamado_id": chamado_id,
            "codigo_rastreio": "AA123456789BR",
            "observacoes": "Reversa criada para teste do sistema"
        }
        
        success, response = self.run_test(
            "Create Reversa",
            "POST",
            "reversas",
            200,
            data=reversa_data
        )
        
        if success and 'id' in response:
            reversa_id = response['id']
            self.created_resources['reversas'].append(reversa_id)
            self.log(f"   Created reversa: {reversa_id}")
            
            # Update reversa
            update_data = {
                "status_reversa": "Em Trânsito",
                "observacoes": "Reversa atualizada - em trânsito"
            }
            
            self.run_test(
                "Update Reversa",
                "PUT",
                f"reversas/{reversa_id}",
                200,
                data=update_data
            )
            
            # Get reversa details
            self.run_test(
                "Get Reversa Details",
                "GET",
                f"reversas/{reversa_id}",
                200
            )
        
        # List all reversas
        self.run_test("List Reversas", "GET", "reversas", 200)

    def test_pedidos_erp(self):
        """Test pedidos ERP operations"""
        self.log("\n=== TESTING PEDIDOS ERP ===")
        
        # Test CSV import
        csv_content = """numero_pedido,status_pedido,nota_fiscal,codigo_rastreio,transportadora
TEST001,Enviado,NF-001,AA123456789BR,Correios
TEST002,Entregue,NF-002,BB987654321BR,Total Express"""
        
        files = {
            'file': ('test_pedidos.csv', io.StringIO(csv_content), 'text/csv')
        }
        
        success, response = self.run_test(
            "Import Pedidos CSV",
            "POST",
            "pedidos-erp/import",
            200,
            files=files
        )
        
        if success:
            self.log(f"   Import result: {response.get('message', 'Success')}")
        
        # List pedidos ERP
        self.run_test("List Pedidos ERP", "GET", "pedidos-erp", 200)
        
        # Get specific pedido
        self.run_test("Get Pedido ERP", "GET", "pedidos-erp/TEST001", 200)

    def test_dashboard(self):
        """Test dashboard statistics"""
        self.log("\n=== TESTING DASHBOARD ===")
        
        success, stats = self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)
        
        if success:
            self.log(f"   Total abertos: {stats.get('total_abertos', 0)}")
            self.log(f"   Total fechados: {stats.get('total_fechados', 0)}")
            self.log(f"   Chamados atenção: {len(stats.get('chamados_atencao', []))}")

    def test_error_cases(self):
        """Test error handling"""
        self.log("\n=== TESTING ERROR CASES ===")
        
        # Test invalid chamado ID
        self.run_test("Get Invalid Chamado", "GET", "chamados/invalid-id", 404)
        
        # Test create chamado without required fields
        self.run_test(
            "Create Invalid Chamado",
            "POST",
            "chamados",
            400,
            data={"numero_pedido": ""}
        )
        
        # Test unauthorized access (without token)
        old_token = self.token
        self.token = None
        self.run_test("Unauthorized Access", "GET", "chamados", 401)
        self.token = old_token

    def cleanup_resources(self):
        """Clean up created test resources"""
        self.log("\n=== CLEANING UP TEST DATA ===")
        
        # Delete created chamados (this will cascade delete historicos and reversas)
        for chamado_id in self.created_resources['chamados']:
            success, _ = self.run_test(
                f"Delete Chamado {chamado_id}",
                "DELETE",
                f"chamados/{chamado_id}",
                200
            )
            if success:
                self.log(f"   Cleaned up chamado: {chamado_id}")

    def run_all_tests(self):
        """Run all test suites"""
        self.log("🚀 Starting WeConnect API Tests")
        self.log(f"Testing against: {self.base_url}")
        
        # Test authentication first
        if not self.test_auth_flow():
            return 1
        
        # Test main functionality
        chamado_id = self.test_chamados_crud()
        self.test_historico(chamado_id)
        self.test_reversas(chamado_id)
        self.test_pedidos_erp()
        self.test_dashboard()
        self.test_error_cases()
        
        # Clean up
        self.cleanup_resources()
        
        # Print results
        self.log(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            self.log("🎉 Tests completed successfully!")
            return 0
        else:
            self.log("⚠️  Some tests failed - check the logs above")
            return 1

def main():
    tester = WeConnectAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())