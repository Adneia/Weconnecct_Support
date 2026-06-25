path = '/opt/elo-atendimento-test/frontend/src/pages/ImportarPedidos.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Fix tooltip
c = c.replace(
    'title="Sincroniza apenas pedidos alterados nas últimas 24h (rápido)"',
    'title="Mesmo sync incremental que roda automaticamente a cada ~15 min"'
)

# Fix label
c = c.replace(
    'Sincronizar Agora\n              </Button>',
    '⚡ Sync Rápido\n              </Button>'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print('done, count:', c.count('Sync Rápido'))
