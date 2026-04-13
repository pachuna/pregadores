# Pregadores — Revisitas

## Visão Geral

App de gerenciamento de revisitas para pregadores, com mapa interativo. Permite registrar pessoas visitadas com localização geográfica e encontrar revisitas próximas.


description: Aplica padroes de qualidade e manutencao do projeto.
---



## Autue como :
- Sempre atue como Especialista em Desenvolvimento
- sempre se preocupe com Segurança principalmente as possíveis vulnerabilidades.
- Entender o requisito.
- Buscar contexto do projeto.
- Implementar mudancas pequenas e seguras.
- Validar erros e testes.

## Explore Agent
Use para exploracao rapida de codigo e mapeamento de estrutura.

Responsabilidades:


## Review Mode
Use quando o pedido for revisao.

## Responsabilidades:
- Priorizar bugs, regressao de comportamento e risco.
- Apontar lacunas de teste.
- Fornecer achados por severidade.
- Encontrar arquivos relevantes.
- Identificar pontos de alteracao.
- Resumir riscos e dependencias.


## Quando usar
- Criacao de novos modulos
- Refatoracoes
- Ajustes de arquitetura

## Regras
- Priorizar simplicidade e legibilidade.
- Evitar acoplamento desnecessario.
- Manter funcoes coesas e pequenas.
- Adicionar testes para comportamentos criticos.

## Checklist de saida
- [ ] Mudanca minima implementada
- [ ] Impacto lateral analisado
- [ ] Erros/lint verificados
- [ ] Testes executados (quando houver)


## Identidade visual Projeto

- Utilizar a mesma do JW.org, mesmas cores e padrões de letras.




**Stack:** Next.js 15.3 · React 19 · TypeScript 5.7 · Tailwind CSS 4.1 · Zustand 5 · Axios

## Estrutura do Projeto

```
src/
├── app/
│   ├── globals.css          # Estilos globais + variáveis CSS (paleta JW.org)
│   ├── layout.tsx           # Layout raiz (metadata, PWA)
│   ├── page.tsx             # Redirect → /home ou /login
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts    # POST login
│   │   │   ├── register/route.ts # POST registro
│   │   │   └── refresh/route.ts  # POST refresh token
│   │   └── revisits/
│   │       ├── route.ts          # GET lista + POST criar
│   │       └── nearby/route.ts   # GET nearby (Haversine)
│   ├── home/page.tsx        # Mapa principal com revisitas
│   ├── login/page.tsx       # Login + Registro (abas)
│   └── revisits/
│       ├── nearby/page.tsx  # Lista de revisitas próximas (raio 15km)
│       └── new/page.tsx     # Criar nova revisita (picker no mapa)
├── components/
│   ├── AuthGuard.tsx        # Proteção de rotas (redireciona se sem token)
│   ├── LocationPickerMap.tsx # Seletor de localização no mapa
│   └── RevisitsMap.tsx      # Mapa com markers de revisitas
├── generated/
│   └── prisma/              # Prisma Client gerado (gitignored)
├── lib/
│   ├── api.ts               # Axios instance + endpoints (aponta /api/*)
│   ├── auth-middleware.ts   # Extrai userId do Bearer token
│   ├── jwt.ts               # Sign/verify JWT (jose, HS256)
│   ├── prisma.ts            # Singleton PrismaClient (adapter libsql)
│   └── types.ts             # Interfaces TypeScript (AuthTokens, Revisit)
└── store/
    └── authStore.ts         # Zustand store (tokens, persistência localStorage)

prisma/
├── schema.prisma            # Schema: User + Revisit
├── migrations/              # Migration inicial aplicada
└── dev.db                   # SQLite database (gitignored)
```

## Contratos da API (Frontend espera)

### Autenticação

| Método | Rota              | Body                        | Resposta           |
|--------|-------------------|-----------------------------|--------------------|
| POST   | `/auth/login`     | `{ email, password }`       | `{ accessToken, refreshToken }` |
| POST   | `/auth/register`  | `{ email, password }`       | `{ accessToken, refreshToken }` |
| POST   | `/auth/refresh`   | `{ refreshToken }`          | `{ accessToken, refreshToken }` |

### Revisitas (requer `Authorization: Bearer <token>`)

| Método | Rota               | Params / Body                                              | Resposta       |
|--------|--------------------|------------------------------------------------------------|----------------|
| GET    | `/revisits`        | —                                                          | `Revisit[]`    |
| GET    | `/revisits/nearby` | `?latitude=X&longitude=Y&radiusKm=15`                     | `Revisit[]`    |
| POST   | `/revisits`        | `{ name, address, latitude, longitude, notes?, visitDate }` | `Revisit`      |

### Tipo Revisit

```ts
interface Revisit {
  id: string;
  userId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  visitDate: string;       // ISO date
  createdAt: string;       // ISO datetime
  updatedAt: string;       // ISO datetime
  distanceKm?: number;     // só no endpoint nearby
}
```

## Variáveis de Ambiente

| Variável                      | Descrição                    | Padrão                  |
|-------------------------------|------------------------------|-------------------------|
| `NEXT_PUBLIC_API_URL`         | URL base da API              | `http://localhost:3000`  |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Chave do Google Maps API     | — (fallback para lista) |

## Estado Atual

### ✅ Pronto (Frontend)

- Login / Registro com abas
- Token management com Zustand + localStorage
- Mapa interativo com Google Maps (+ fallback sem chave)
- Criar revisita com seleção de local no mapa
- Listar revisitas próximas ordenadas por distância
- AuthGuard protegendo rotas
- PWA (manifest.json, standalone)
- UI responsiva, paleta JW.org (#4a6da7 primary, #c18f59 accent)
- Frontend atualizado para apontar `/api/auth/*` e `/api/revisits/*` (src/lib/api.ts)

### ✅ Pronto (Backend — completo)

- **Prisma 7.5 + SQLite** configurado com schema (User + Revisit) e migration aplicada (`prisma/migrations/`)
- **Banco dev.db** criado em `prisma/dev.db`
- **Dependências instaladas:** prisma, @prisma/client, bcryptjs, jose, @prisma/adapter-libsql, @libsql/client, dotenv
- **Libs backend criadas:**
  - `src/lib/prisma.ts` — Singleton PrismaClient com adapter libsql
  - `src/lib/jwt.ts` — Sign/verify access e refresh tokens (jose, HS256)
  - `src/lib/auth-middleware.ts` — Extrai userId do Bearer token
- **API Routes criadas:**
  - `src/app/api/auth/login/route.ts` — POST login (bcrypt compare)
  - `src/app/api/auth/register/route.ts` — POST registro (bcrypt hash, 12 rounds)
  - `src/app/api/auth/refresh/route.ts` — POST refresh token
  - `src/app/api/revisits/route.ts` — GET lista + POST criar revisita
  - `src/app/api/revisits/nearby/route.ts` — GET nearby com Haversine
- **Variáveis .env:** DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

### ✅ Pronto (Validação Completa — 2026-03-22)

- **Build Next.js** — `npm run build` compila sem erros (Next.js 15.5.14)
- **Fluxo completo testado com sucesso:**
  - POST `/api/auth/register` — Cria usuário, retorna tokens ✅
  - POST `/api/auth/login` — Autentica, retorna tokens ✅
  - POST `/api/auth/refresh` — Renova tokens ✅
  - POST `/api/revisits` — Cria revisita com auth ✅
  - GET `/api/revisits` — Lista revisitas do usuário ✅
  - GET `/api/revisits/nearby` — Retorna revisitas ordenadas por distância com `distanceKm` ✅

### 🔲 Pendente

- Resolver vulnerabilidades npm (11 — todas do Prisma CLI, dev-only, não vão para produção)
- Considerar rate limiting nos endpoints de auth
- Deploy para produção

## Convenções

- **Idioma da UI:** Português (pt-BR)
- **State management:** Zustand com persist middleware
- **HTTP client:** Axios com interceptor de Bearer token
- **Styling:** Tailwind CSS com variáveis CSS customizadas
- **Path alias:** `@/*` → `./src/*`
- **Rotas protegidas:** Envolver com `<AuthGuard>`

## Comandos

```bash
npm run dev    # Servidor de desenvolvimento
npm run build  # Build de produção
npm run start  # Iniciar produção
npm run lint   # Lint
```

## Notas de Desenvolvimento

- A API URL padrão aponta para `localhost:3000` (mesma porta do Next.js). O backend pode usar Next.js API Routes (App Router: `src/app/api/`) ou um servidor separado em outra porta.
- O componente RevisitsMap tem fallback para modo lista quando `NEXT_PUBLIC_GOOGLE_MAPS_KEY` não está definida.
- LocationPickerMap mostra inputs manuais de lat/lng como fallback sem Google Maps.
- O frontend já lida com erros genéricos nos formulários.
