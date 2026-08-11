# A Torre das Sete Luzes 🕯️

Jogo 2D de plataforma para navegador baseado na **Cerimônia da Luz** (Ordem DeMolay).

Suba os sete andares da torre, quebre as trancas místicas respondendo trechos da
cerimônia e acenda as sete velas para se apresentar ao Rei e ser condecorado
**Cavaleiro da Guarda Real**.

## Como rodar localmente

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

## Build de produção

```bash
npm run build    # gera a pasta dist/ (estática, pronta para qualquer host)
npm run preview  # testa o build localmente
```

## Deploy

### Vercel
1. Suba o repositório para o GitHub.
2. Em vercel.com, importe o repositório.
3. Framework preset: **Vite** (detectado automaticamente). Build: `npm run build`, output: `dist`. Pronto.

### GitHub Pages
O `vite.config.ts` já usa `base: './'`, então o build funciona em subpastas.

```bash
npm run build
# publique o conteúdo de dist/ na branch gh-pages, por exemplo:
npx gh-pages -d dist
```

Ou use GitHub Actions (Settings → Pages → Source: GitHub Actions → workflow "Static HTML" apontando para `dist`).

## Variáveis de ambiente

Todas estão descritas em `.env.example` — copie para `.env.local` (ignorado pelo
git) ou use `vercel env pull .env.local`.

| Variável | Para quê |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Postgres do ranking e das corridas |
| `APP_SECRET` | assina os tokens de corrida entregues ao cliente |
| `SESSION_SECRET` | assina o cookie de sessão do painel de moderação |
| `ADMIN_PASSWORD_HASH` | senha do painel (`npm run admin:hash -- "senha"`) |
| `MANUTENCAO_CODIGO` | código do cofre da tela de manutenção — **padrão `199`** |
| `MANUTENCAO_HASH` | senha só da manutenção; sem ela vale `ADMIN_PASSWORD_HASH` |
| `VITE_MANUTENCAO` | mostra a tela de manutenção — **build**, padrão ligado em produção |
| `VITE_COFRE` | desenha a fechadura na tela de manutenção — **build**, padrão ligado |

### Tela de manutenção

Duas chaves decidem o portão, e são **variáveis de build** (`VITE_*`, embutidas
no bundle): mudar na Vercel só vale depois de um redeploy.

| `VITE_MANUTENCAO` | `VITE_COFRE` | O que o jogador encontra |
|---|---|---|
| `on` | `on` | tela de manutenção com a fechadura — quem sabe o código atravessa |
| `on` | `off` | tela de manutenção para todos, sem passagem nenhuma |
| `off` | qualquer | jogo aberto (o dia do lançamento) |

Sem as variáveis: manutenção **ligada** em produção — esquecer de configurar não
pode abrir o jogo ao mundo por acidente — e desligada no `npm run dev`; cofre
ligado. Ambas aceitam `on/off`, `1/0`, `true/false`, `sim/não`.

Com o cofre ligado, quem entra vê o recado e um **cofre digital** desenhado
abaixo do cavaleiro. Digitar o código (teclado numérico na tela ou o teclado
físico) chama `POST /api/manutencao`, e o acerto grava a liberação no
`localStorage` deste navegador. Desligar o cofre fecha até para esses
navegadores: a única passagem deixou de existir.

Vale lembrar que isso é uma **tranca social**, não uma fronteira de segurança:
três dígitos são mil combinações e quem segura a força bruta é o rate limit da
rota. Atravessar a manutenção não dá poder nenhum sobre o jogo nem sobre o
banco. Defina `MANUTENCAO_CODIGO=` (vazio) para desligar o cofre e exigir a
senha via scrypt.

## Controles

| Ação | Desktop | Mobile |
|---|---|---|
| Andar | ← → ou A/D | ◀ ▶ |
| Pular / subir escada | Espaço ou ↑ / W | ⬆ |
| Descer escada | ↓ / S | ⬇ |
| Interagir (vela / Rei) | E ou Enter | ✦ |
| Responder | A B C D ou clique | toque |
| Habilidades | teclas 1–7 | toque no ícone |
| Recuar do combate | ESC | ✕ recuar |

## Regras

- Cada andar (1–7) guarda uma vela protegida por **2 trancas**.
- Acertar a lacuna quebra 1 tranca; errar ou estourar o tempo **restaura todas as trancas daquela vela**.
- Vela sem trancas pode ser **acesa** — e concede uma habilidade (teclas 1–7):
  1. **Olhar do Ágape** — elimina uma alternativa falsa
  2. **Sopro da Fé** — revela parte da resposta e encurta uma falsa
  3. **Gentileza do Tempo** — congela o tempo
  4. **Elo dos Irmãos** — errar não restaura as trancas
  5. **Voto de Fidelidade** — a próxima habilidade não apaga sua vela
  6. **Pensamento Puro** — destrói uma tranca instantaneamente
  7. **Luz Plena** — revela e responde corretamente
- **Custo:** usar uma habilidade **apaga a vela** e devolve 1 tranca a ela.
- O 8º andar só abre com as **sete velas acesas simultaneamente**.

## Dificuldades

| Nível | Tempo | Opções | Lacuna | Banco de texto |
|---|---|---|---|---|
| Escudeiro | 10s | 2 | 1 palavra | só a vela do andar |
| Iniciático | 10s | 3 | 2–3 palavras | vela + abertura |
| DeMolay | 10s | 4 | frases | vela + abertura + encerramento |
| Cavaleiro | 5s | 4 | frases | vela + abertura + encerramento |

## Ajustes rápidos (src/data/config.ts)

- `LOCKS_PER_FLOOR` — trancas por andar (ex.: `[2,4,6,8,10,12,14]` para escalar).
- `LOCKS_RETURNED_ON_ABILITY` — custo em trancas ao usar habilidade.
- `DIFFICULTIES` — tempos, nº de opções e banco de texto.
- `ABILITIES` — nomes e descrições das habilidades.

## Arte e áudio

Toda a arte é **pixel art procedural** gerada em `src/scenes/Boot.ts` e o áudio é
**100% sintetizado** via WebAudio (`src/systems/audio.ts`) — zero assets, bundle leve.
Para usar sprites reais no futuro, carregue PNGs com as mesmas chaves de textura
(`knight-sheet`, `candle-lit-0`, `bg-castle`, etc.) no lugar da geração procedural.

## Save

Progresso e configurações ficam no `localStorage` do navegador
(`cerimonia-da-luz:save:v1` e `cerimonia-da-luz:settings:v1`).
