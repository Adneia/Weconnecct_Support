import re

path = '/opt/elo-atendimento-test/frontend/src/pages/ImportarPedidos.js'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Adiciona tabelao_inc ao mapa de endpoints
old_endpoints = """      tabelao: 'sync-from-postgres',
      fornecedores: 'sync-fornecedores-from-postgres',"""

new_endpoints = """      tabelao: 'sync-from-postgres',
      tabelao_inc: 'sync-tabelao-incremental',
      fornecedores: 'sync-fornecedores-from-postgres',"""

content = content.replace(old_endpoints, new_endpoints, 1)

# 2. Substitui o botão do Tabelão por um container com info + botão "Sync Rápido"
old_tabelao = """            <Button variant="outline" className="border-purple-300 justify-start" onClick={() => disparaSync('tabelao')} disabled={syncStatus.tabelao?.running}>
              {syncStatus.tabelao?.running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              <div className="flex flex-col items-start text-left">
                <span>Tabelão (pedidos)</span>
                <span className="text-xs text-muted-foreground">{fmtSyncBadge(syncStatus.tabelao)}</span>
              </div>
            </Button>"""

new_tabelao = """            <div className="border border-purple-300 rounded-md px-3 py-2 flex items-center gap-2">
              {(syncStatus.tabelao?.running || syncStatus.tabelao_inc?.running)
                ? <Loader2 className="h-4 w-4 text-purple-600 animate-spin flex-shrink-0" />
                : <RefreshCw className="h-4 w-4 text-purple-600 flex-shrink-0" />}
              <div className="flex flex-col items-start text-left flex-1 min-w-0">
                <span className="text-sm font-medium">Tabelão (pedidos)</span>
                <span className="text-xs text-muted-foreground">
                  {syncStatus.tabelao_inc?.running
                    ? '⚡ Sync rápido em andamento...'
                    : syncStatus.tabelao?.running
                      ? '🔄 Sync completo em andamento...'
                      : fmtSyncBadge(syncStatus.tabelao)}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-purple-400 text-purple-700 hover:bg-purple-50 shrink-0 h-7 text-xs px-2 gap-1"
                onClick={() => disparaSync('tabelao_inc')}
                disabled={syncStatus.tabelao?.running || syncStatus.tabelao_inc?.running}
                title="Sincroniza apenas pedidos alterados nas últimas 24h (rápido)"
              >
                {syncStatus.tabelao_inc?.running
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RefreshCw className="h-3 w-3" />}
                Sincronizar Agora
              </Button>
            </div>"""

if old_tabelao in content:
    content = content.replace(old_tabelao, new_tabelao, 1)
    print("OK - tabelao button replaced")
else:
    print("ERROR - old_tabelao not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
