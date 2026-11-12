# Plano: multi-cidades online (cliente ⇄ servidor)

Reimplementação do sistema de múltiplas cidades do `master`, do zero, sobre o branch
`servidor`, com uma arquitetura nova: **cada cliente conecta seu mundo single-player a um
servidor** e as cidades conectadas abrem rotas de comércio e migração entre si.

## Diferença fundamental em relação ao master

| Master (multi-cidades local) | Multicity online (este branch) |
|---|---|
| Todas as cidades são workers na mesma máquina (`WorldCoordinator` + `CitySession`) | Cada cidade vive em um cliente diferente; o servidor só coordena |
| Relógio global imposto (barreira de tempo: o mundo avança até o menor minuto reportado) | **Cada cidade mantém seu relógio local**; viagens são medidas em minutos simulados de cada cidade |
| Comércio/migração entre sessões locais | Comércio/migração via mensagens; o servidor guarda o ledger |
| Salvar o mundo = salvar todas as cidades | Cada cliente salva seu próprio mundo + estado de rede; o servidor persiste o ledger das transferências |

## Componentes novos

### 1. Servidor (`server/`, Node, zero dependências)

- `server/websocket.mjs` — servidor WebSocket mínimo (RFC 6455) sobre `node:http`.
- `server/world_server.mjs` — coordenador do mundo online:
  - **Registro de cidades**: cada cliente se apresenta com `cityId`, nome, população,
    estoques/prços resumidos, porto e minuto local. O servidor mantém o diretório e
    transmite mudanças para todos.
  - **Pedidos (request/response)**: o servidor relata operações ao cliente dono de uma
    cidade (`reserveWorldExport`, `reserveWorldPayment`, `receiveWorldImport`,
    `receiveWorldCitizenMigration` etc. — os mesmos handlers da simulação) com
    correlação por `reqId`.
  - **Transferências**: máquina de estados `scheduled → in-transit → arriving →
    delivered / cancelled`. Partida = confirmação da cidade de origem; chegada =
    aplicada quando a cidade de destino **atinge o minuto previsto** (`arrivalMinute`
    = minuto local do destino no agendamento + duração da viagem).
  - **Ledger persistido** (`server/data/ledger.json`, escrita atômica temporário+rename,
    formato versionado): transferências ativas e histórico confirmado. Cidade offline
    **retém** a transferência no servidor; ao reconectar, o cliente relata o que já
    aplicou e o servidor reconcilia (reentrega sem duplicar, cancela com rollback).
- Sem simulador de cidades no servidor: o servidor nunca roda economia; ele só
  coordena, retém e liquida estados entre clientes.

### 2. Camada de rede do cliente (`js/world_net.js`)

- WebSocket do navegador com reconexão exponencial, correlação `reqId` e fila de
  pedidos que o servidor faz à cidade.
- Publica resumos periódicos da cidade (o worker já emite `summary` a cada ~5 s).
- Expõe a mesma superfície que o `WorldTradeService` do master para a UI:
  comprar/vender entre cidades, contratos recorrentes, migração individual e familiar,
  políticas autônomas — mas a contraparte é remota.

### 3. Simulação (portado do master, adaptado)

Os handlers de simulação são reutilizados quase integralmente — eles já são
idempotentes, por transferência, e independentes de rede:

- **Porto municipal** (`worldPort`): cais escolhido por geração do assentamento, rota
  de borda navegável, inventário, reservas, recibos e pagamentos.
- **Comércio**: `reserveWorldExport` → `departWorldExport` → (viagem) →
  `receiveWorldImport` → `deliverWorldImport` → liquidação local. Pagamentos ficam
  **locais em cada lado**: o comprador paga de sua base monetária para a conta do
  porto; o vendedor recebe como renda externa de exportação — nenhuma base monetária
  atravessa a rede, cada mundo continua autoconsistente.
- **Migração**: pacote versionado v1 (indivíduo) e v2 (núcleo familiar) com identidade
  global estável `cityId:citizenId`, vínculos, habilidades, política, pertences e
  veículos de mobilidade pessoal.
- **Embarcações locais**: classes de barco, estaleiros (`shipyard`, `boat_shop`,
  `boat_workshop`), frota do porto, navegação local por água no A* (`findBoatPath`),
  missões de piloto (`crewMissions`).

### 4. UI

- Janela **“Mundo e rotas”** no desktop: conectar/desconectar do servidor, diretório
  de cidades conectadas, compra/venda marítima, contratos, migração, transferências
  em trânsito e histórico.
- Barcos e portos renderizados em 3D como no master (embarcação municipal, barcos em
  viagem desenhados pela posição do trânsito).

## Fluxo de uma compra entre cidades (exemplo)

```text
Cliente B (comprador)                 Servidor                        Cliente A (vendedor)
      │ trade:request ────────────────▶│                                 │
      │                                │ req reserveWorldExport ────────▶│ (reserva estoque→carrega no porto)
      │                                │◀──────────── ok                 │
      │◀── req reserveWorldPayment     │                                 │
      │◀── req reserveWorldImport      │ (reserva pagamento + demanda)   │
      │ ok ───────────────────────────▶│                                 │
      │                                │ transferência scheduled         │
      │                                │ req departWorldExport (A) ─────▶│ (carga parte; barco sai)
      │                                │ in-transit; arrival = minuto(B) │
      │                                │   + duração da rota             │
      │ (quando B.atualiza minute≥chegada)                               │
      │◀── req receiveWorldImport ─────│ req deliverWorldImport ────────▶│ etc.
      │◀── liquidação local            │ ledger: delivered               │ renda de exportação em A
```

## Etapas de entrega

1. **Base marítima local** ✅ — portos, embarcações, navegação local e renderização
   (fundação do master portada sobre o branch atual, sem multi-cidades local).
2. **Servidor** ✅ — `server/websocket.mjs` (RFC 6455 zero-dep) + `server/world_server.mjs`
   (registro, relé de pedidos, máquina de transferências, contratos, comércio
   regional autônomo, políticas de migração, ledger persistido). 20 testes.
3. **Cliente online** ✅ — `js/world_net.js` (cliente WS + espelho do coordenador com a
   mesma superfície do antigo `WorldCoordinator` para UI e renderer), `js/city_world_ui.js`
   (janela “Mundo e rotas” online) e integração no `app.js`. 5 testes do espelho +
   smoke test ponta a ponta com dois clientes WebSocket reais.
4. **Recuperação** ✅ — ledger retoma transferências no reconectamento; cancelamentos
   decididos offline são limpos com rollback idempotente no retorno.

### Como rodar

```bash
node server/world_server.mjs --port 8787            # servidor do mundo (sem ledger)
node server/world_server.mjs --port 8787 --data server/data   # com ledger persistido
```

No jogo: menu “Mundo, comércio e migração” → CONECTAR AO SERVIDOR
(`ws://localhost:8787` por padrão; ENDEREÇO… para trocar).

### Notas de implementação

- As versões de cache-buster (`?v=…`) foram unificadas em todo o repositório para
  evitar módulos duplicados (classes instanciadas duas vezes quebram `instanceof`).
- O dinheiro nunca atravessa a rede: o comprador paga de sua base monetária para a
  conta externa e o vendedor recebe renda de exportação da sua conta externa
  (`supplier`), como no comércio exterior de cidade única.
- `reserveWorldExport`/`reserveWorldImport` aceitam `buildingId` nulo e escolhem o
  melhor prédio local (excedente + caminho ao porto; necessidade + balanço + espaço).

## Fora do primeiro ciclo

Câmbio entre moedas locais, oceano navegável célula a célula entre mapas, combate,
turismo, simulação de cidades desligadas no servidor.
