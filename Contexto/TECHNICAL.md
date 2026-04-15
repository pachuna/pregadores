# Documento Técnico — Pregadores V2

> **Leia este documento ANTES de implementar qualquer nova feature ou corrigir qualquer bug.**  
> Objetivo: entender o que já existe, como se conecta e quais são os pontos de atenção para não quebrar fluxos em produção.

---

## 1. Stack e Infraestrutura

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript |
| Estilização | Tailwind CSS 4 |
| Estado global | Zustand (persistido em `localStorage`) |
| ORM | Prisma 7 |
| Banco de dados | PostgreSQL |
| Autenticação | JWT (`jose`) — access token 15 min + refresh token 7 dias |
| Push Notifications | `web-push` + VAPID |
| Mapas | Leaflet (carregado via `dynamic` com `ssr: false`) |
| Servidor | VPS Ubuntu 24.04, PM2, Nginx |

**CSP atual:**
- Desenvolvimento: `Content-Security-Policy-Report-Only`
- Produção: `Content-Security-Policy` efetiva
- `unsafe-eval` fica liberado apenas em desenvolvimento por causa do bundler do Next/Webpack
- Produção libera somente os domínios client-side necessários para Google Identity, Google Maps JS e Places

**Variáveis de ambiente críticas (VPS `.env.production`):**
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `ADMIN_EMAIL`
- `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `DATABASE_URL`
- `NODE_OPTIONS=--dns-result-order=ipv4first` (no `ecosystem.config.cjs`) — evita ETIMEDOUT no Google OAuth

---

## 2. Banco de Dados — Modelos Prisma

### 2.1 Enums

```
Role:                ADMIN | ANCIAO | PUBLICADOR | SERVO_DE_CAMPO
TerritoryType:       IMAGE | STREETS
HouseVisitStatus:    OK | FAIL
CongregationStatus:  PENDING | ACTIVE | BLOCKED | REJECTED
JoinRequestStatus:   PENDING | APPROVED | REJECTED
```

**Hierarquia de roles (maior → menor permissão):**
`ADMIN` > `ANCIAO` > `SERVO_DE_CAMPO` > `PUBLICADOR`

### 2.2 User
| Campo | Tipo | Observação |
|-------|------|------------|
| id | cuid | PK |
| email | String unique | |
| name | String? | Obrigatório para solicitar entrada em congregação |
| passwordHash | String | bcrypt salt=12 |
| firebaseUid | String? unique | Legado — migração do Firebase |
| role | Role | default PUBLICADOR |
| isBlocked | Boolean | default false |
| congregationId | String? | FK → Congregation |
| lastSeenAt | DateTime? | Atualizado via `/api/presence` |

### 2.3 Congregation
| Campo | Tipo | Observação |
|-------|------|------------|
| id | cuid | PK |
| name | String | |
| jwEmail | String | E-mail do Salão do Reino |
| state | String | UF (ex: "SP") |
| city | String | |
| status | CongregationStatus | default PENDING — precisa de aprovação do ADMIN |
| rejectionReason | String? | Motivo de recusa pelo ADMIN |
| createdById | String | FK → User |

### 2.4 Territory
| Campo | Tipo | Observação |
|-------|------|------------|
| id | cuid | PK |
| firebaseId | String? unique | Legado — migração do Firestore |
| number | Int unique | Número sequencial do território |
| label | String? | Rótulo exibido no card (ex: "A1", "Norte") |
| territoryType | TerritoryType | IMAGE = mapa estático; STREETS = ruas/casas |
| imageUrl | String? | Caminho relativo ex: `/territorios/{id}.jpg` |
| color | String | Cor do card hex, default `#cccccc` |
| hidden | Boolean | default false |
| lastUpdate | DateTime? | |
| lastSharedAt | DateTime? | Atualizado ao compartilhar |
| congregationId | String? | FK → Congregation |

### 2.5 Street → House → HouseVisit
Hierarquia: `Territory` → `Street` → `House` → `HouseVisit`

- **Street**: `id` (UUID do Firestore), `name`, `lastUpdate`, `territoryId`
- **House**: `id` (UUID do Firestore), `number` (String), `observation?`, `phones Json[]`, `streetId`
- **HouseVisit**: `id` cuid, `houseId`, `status (OK|FAIL)`, `visitedAt`, `userId?`, `firebaseUserUid?`

> ⚠️ IDs de `Street` e `House` são UUIDs do Firestore (legado) — **não usar `@default(cuid())`** nesses.

### 2.6 PushSubscription
| Campo | Tipo | Observação |
|-------|------|------------|
| id | cuid | PK |
| userId | String | FK → User (cascade delete) |
| endpoint | String unique | URL do push service do browser |
| p256dh | String | Chave pública de criptografia |
| auth | String | Secret de autenticação |

> Subscriptions expiradas (status 410/404) são removidas automaticamente pelo `sendToSubscriptions`.

### 2.7 CongregationJoinRequest
| Campo | Tipo | Observação |
|-------|------|------------|
| id | cuid | PK |
| userId | String | FK → User (cascade delete) |
| congregationId | String | FK → Congregation |
| status | JoinRequestStatus | default PENDING |
| rejectionReason | String? | |
| @@unique | [userId, congregationId] | Um pedido por par |

### 2.8 PioneerReport
| Campo | Tipo | Observação |
|-------|------|------------|
| id | cuid | PK |
| userId | String | FK → User (cascade) |
| date | String | Formato `"YYYY-MM-DD"` |
| hours | Int | default 0 |
| minutes | Int | default 0 |
| creditHours | Int | default 0 |
| bibleStudies | Int | default 0 |
| goalHours | Int | default 2 |
| notes | String? | |
| @@unique | [userId, date] | Um registro por dia |

### 2.9 Revisit
| Campo | Tipo | Observação |
|-------|------|------------|
| id | cuid | PK |
| userId | String | FK → User (cascade) |
| name / address | String | |
| latitude / longitude | Float | Indexados para busca por proximidade |
| isActive | Boolean | default true |
| visitDate | DateTime | |

---

## 3. Autenticação e Segurança

### 3.1 Fluxo de Tokens
```
Login/Register/Google → { accessToken (15min), refreshToken (7d), role, congregationId, name }
    ↓ persiste no Zustand (localStorage "pregadores-auth")
Req com 401 → interceptor Axios tenta refresh → novo par de tokens
Falha no refresh → logout() + redirect /login?reason=session-expired
```

### 3.2 JWT Payload
- **Access token**: `{ sub: userId, role }` — assina com `JWT_SECRET`
- **Refresh token**: `{ sub: userId }` — assina com `JWT_REFRESH_SECRET`

> ⚠️ O `AuthPayload` do middleware tem **apenas `userId` e `role`** — sem `congregationId`. Para obter congregationId em rotas de API, sempre buscar via `prisma.user.findUnique`.

### 3.3 Helpers de Middleware (`src/lib/auth-middleware.ts`)

| Função | Uso | Permite |
|--------|-----|---------|
| `authenticateRequest` | Qualquer rota autenticada | Qualquer role |
| `requireAdmin` | Rotas exclusivas de admin | ADMIN |
| `requireTerritoryManager` | Gerência de territórios | ADMIN, ANCIAO, SERVO_DE_CAMPO |

### 3.4 AuthGuard (Frontend)
- Envolve todas as páginas que requerem autenticação
- Se não tem `accessToken` mas tem `refreshToken` → tenta renovar silenciosamente
- Se não tem nenhum → redireciona para `/login?redirect=<url-origem>`
- Sempre exibe `AskNameModal` se o usuário não tiver `name` definido

### 3.5 Google OAuth
- Rota: `POST /api/auth/google`
- Valida o `idToken` contra `https://oauth2.googleapis.com/tokeninfo`
- Usa `node:https` (não `fetch`) para respeitar `--dns-result-order=ipv4first`
- Aceita múltiplos `GOOGLE_CLIENT_ID` separados por vírgula
- Se e-mail já existe → loga; se não → cria conta com senha aleatória

### 3.6 CSP e Recursos Externos
- A CSP cobre apenas recursos carregados no navegador; chamadas server-side para Google, ViaCEP, Nominatim e OSM feitas em rotas API não dependem dela
- Origens liberadas no cliente:
  - `accounts.google.com` e `oauth2.googleapis.com` para Google Identity
  - `maps.googleapis.com`, `maps.gstatic.com` e `places.googleapis.com` para Google Maps e autocomplete
- Em produção, `upgrade-insecure-requests` fica ativo; em desenvolvimento ele nao e enviado para evitar warning inutil em modo report-only

---

## 4. APIs — Mapa de Rotas

### 4.1 Auth (`/api/auth/`)

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| POST | `/api/auth/login` | Público | Login com email+senha |
| POST | `/api/auth/register` | Público | Cria conta nova (role PUBLICADOR) |
| POST | `/api/auth/google` | Público | Login/registro via Google OAuth |
| POST | `/api/auth/refresh` | Público (refreshToken) | Renova par de tokens |
| PATCH | `/api/auth/profile` | Autenticado | Atualiza `name` do usuário |

### 4.2 Admin (`/api/admin/`)

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/api/admin/users` | ADMIN | Lista todos os usuários |
| PATCH | `/api/admin/users/[id]` | ADMIN | Altera role, congregationId, isBlocked |
| DELETE | `/api/admin/users/[id]` | ADMIN | Remove usuário |

### 4.3 Revisitas (`/api/revisits/`)

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/api/revisits` | Autenticado | Lista revisitas do usuário logado |
| POST | `/api/revisits` | Autenticado | Cria revisita |
| PATCH | `/api/revisits/[id]` | Autenticado (dono) | Edita revisita |
| DELETE | `/api/revisits/[id]` | Autenticado (dono) | Remove revisita |
| GET | `/api/revisits/nearby` | Autenticado | Revisitas próximas (params: lat, lng, radiusKm) |

### 4.4 Territórios (`/api/territories/`)

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/api/territories` | Autenticado | Lista territórios da congregação |
| POST | `/api/territories` | ADMIN/ANCIAO/SERVO | Cria novo território |
| GET | `/api/territories/[id]` | Autenticado | Detalhe com ruas e casas |
| DELETE | `/api/territories/[id]` | ADMIN/ANCIAO/SERVO | Remove cascata (visitas→casas→ruas→território) + apaga imagem |
| POST | `/api/territories/[id]/image` | ADMIN/ANCIAO/SERVO | Upload imagem (max 5MB, salva em `public/territorios/`) |
| POST | `/api/territories/[id]/share` | ADMIN/ANCIAO/SERVO | Envia push + abre seletor nativo compartilhamento |
| POST | `/api/territories/[id]/generate-map` | ADMIN/ANCIAO/SERVO | Gera mapa via OSM tiles + sharp |
| POST | `/api/territories/[id]/visit` | Autenticado | Registra visita a uma casa (OK ou FAIL) |
| POST | `/api/territories/[id]/streets` | ADMIN/ANCIAO/SERVO | Adiciona rua com casas |
| DELETE | `/api/territories/[id]/streets?streetId=` | ADMIN/ANCIAO/SERVO | Remove rua |
| GET | `/api/territories/street-search?q=` | ADMIN/ANCIAO/SERVO | Busca via ViaCEP (state+city da congregação) |
| GET/POST | `/api/territories/[id]/streets/[streetId]/houses` | ADMIN/ANCIAO/SERVO | Lista / Adiciona casa (bloqueia duplicata case-insensitive) |
| PATCH/DELETE | `/api/territories/[id]/streets/[streetId]/houses/[houseId]` | ADMIN/ANCIAO/SERVO | Edita / Remove casa |

> ⚠️ **Share**: ADMIN pode escolher target (ALL/ADMIN/congregation). ANCIAO/SERVO só envia para a própria congregação.

### 4.5 Congregações (`/api/congregations/`)

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/api/congregations` | ADMIN | Lista todas as congregações |
| POST | `/api/congregations` | ADMIN | Cria congregação |
| GET | `/api/congregations/active` | Autenticado | Lista congregações ACTIVE + pedido pendente do usuário |
| GET | `/api/congregations/[id]` | ADMIN | Detalhe da congregação |
| PATCH | `/api/congregations/[id]` | ADMIN | Altera status, nome, etc. |
| GET | `/api/congregations/[id]/members` | ADMIN/ANCIAO (própria cong.) | Lista membros |
| POST | `/api/congregations/[id]/join` | Autenticado | Solicita entrada (cria JoinRequest) |
| GET | `/api/congregations/[id]/join` | ADMIN/ANCIAO (própria cong.) | Lista pedidos PENDING |
| PATCH | `/api/congregations/[id]/join/[requestId]` | ADMIN/ANCIAO (própria cong.) | Aprovar/Rejeitar |
| DELETE | `/api/congregations/[id]/join/[requestId]` | Dono do pedido | Cancela próprio pedido |

### 4.6 Push Notifications (`/api/push/`)

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| POST | `/api/push/subscribe` | Autenticado | Registra/atualiza subscription (upsert por endpoint) |
| DELETE | `/api/push/subscribe` | Autenticado | Remove subscription |
| POST | `/api/push/send` | ADMIN | Envia push manual |

Pré-requisito de ambiente:
- `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` no servidor
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` no cliente (mesmo valor de `VAPID_PUBLIC_KEY`)

### 4.7 Outras

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| POST | `/api/presence` | Autenticado | Atualiza `lastSeenAt` do usuário |
| GET | `/api/stats` | Autenticado | Totais: usuários, online, revisitas |
| GET/POST/PATCH | `/api/pioneer` | Autenticado | Relatório pioneiro (GET: lista mês; POST: upsert) |

---

## 5. Push Notifications — Biblioteca (`src/lib/push.ts`)

### Funções disponíveis

| Função | Descrição |
|--------|-----------|
| `notifyAll(payload)` | Todos os usuários com subscription |
| `notifyByRole(role, payload)` | Todos de uma role específica |
| `notifyByCongregation(congregationId, payload)` | Todos de uma congregação |
| `notifyUser(userId, payload)` | Um usuário específico (todas as subscriptions dele) |
| `notifyByRolesInCongregation(congregationId, roles[], payload)` | Roles específicas de uma congregação **+ todos os ADMINs globais** — 1 query só |

### PushPayload
```ts
{ title: string; body: string; url?: string }
```
> `url` deve ser **relativa** (ex: `/congregations`) — o SW concatena com `self.location.origin`.

### Comportamento de subscriptions expiradas
- Erros 410/404 ao enviar → subscription é deletada automaticamente do banco.

### Quando cada função é usada
| Evento | Função chamada |
|--------|---------------|
| Solicitar entrada em congregação | `notifyByRolesInCongregation(congId, ["ANCIAO","SERVO_DE_CAMPO"])` |
| Compartilhar território | `notifyByCongregation` ou `notifyAll` ou `notifyByRole("ADMIN")` |
| Push manual (admin) | `notifyAll` / `notifyByRole` / `notifyByCongregation` |

---

## 6. Service Worker (`public/sw.js`)

- **Cache**: `pregadores-v4` — caches assets estáticos + páginas visitadas
- **Estratégia**: Network-first com fallback para cache; `/api/` nunca é cacheado
- **Push handler**: recebe `{ title, body, url }` — exibe `showNotification`
- **Notification click**: navega para `data.url` — abre janela existente ou nova
- **Atualização de versão**: mudar `CACHE_NAME` para `pregadores-v5` força re-instalação

---

## 7. Estado Global — Zustand (`src/store/authStore.ts`)

Persistido em `localStorage` com chave `"pregadores-auth"`.

```ts
{
  accessToken: string | null
  refreshToken: string | null
  role: string | null          // "ADMIN" | "ANCIAO" | "PUBLICADOR" | "SERVO_DE_CAMPO"
  congregationId: string | null
  name: string | null
  setTokens(...)
  setName(name)
  logout()
}
```

> ⚠️ `role` e `congregationId` vêm do **token JWT no momento do login**. Se o ADMIN alterar o role de um usuário, o usuário precisa fazer logout + login para ver a mudança no frontend.

---

## 8. Cliente HTTP (`src/lib/api.ts`)

- Axios com `baseURL = NEXT_PUBLIC_API_URL` (vazio em produção → usa path relativo)
- **Interceptor de request**: injeta `Authorization: Bearer <accessToken>`
- **Interceptor de response**: em 401, tenta refresh silencioso (um único `refreshPromise` compartilhado para evitar race condition); se falhar → `logout()` + redirect

### Objetos de API disponíveis
| Objeto | Descrição |
|--------|-----------|
| `authApi` | login, register, google, refresh, updateProfile |
| `revisitsApi` | list, nearby, create, update, delete |
| `statsApi` | get |
| `presenceApi` | ping |
| `adminApi` | listUsers, updateUser, deleteUser |
| `pushApi` | send |
| `territoriesApi` | list, getById, markVisit, create, uploadImage, addStreet, removeStreet, searchStreets, generateMap, delete, share, addHouse, updateHouse, deleteHouse |
| `congregationsApi` | listActive, requestJoin, cancelJoinRequest, getJoinRequests, approveJoinRequest, rejectJoinRequest, getMembers, updateMember |
| `pioneerApi` | list, upsert |

---

## 9. Páginas e Componentes

### 9.1 Estrutura de Páginas

| Rota | Arquivo | Guard | Descrição |
|------|---------|-------|-----------|
| `/` | `app/page.tsx` | Nenhum | Redirect para `/home` ou `/login` |
| `/login` | `app/login/page.tsx` | Nenhum | Login/Register/Google OAuth |
| `/home` | `app/home/page.tsx` | AuthGuard | Dashboard: stats + revisitas próximas + timer pioneiro |
| `/mapa` | `app/mapa/page.tsx` | AuthGuard | Mapa Leaflet com revisitas + bottom sheet |
| `/revisits/new` | `app/revisits/new/page.tsx` | AuthGuard | Formulário nova revisita com picker de localização |
| `/revisits/nearby` | `app/revisits/nearby/page.tsx` | AuthGuard | Lista de revisitas próximas da localização atual |
| `/pioneiro` | `app/pioneiro/page.tsx` | AuthGuard | Relatório pioneiro: calendário + timer + metas |
| `/congregations` | `app/congregations/page.tsx` | AuthGuard | Visão de congregação: membros, territórios, pedidos |
| `/congregations/territories/[id]` | AuthGuard | Detalhe do território: ruas, casas, visitas, compartilhar |
| `/admin` | `app/admin/page.tsx` | AuthGuard + role ADMIN | Painel admin: usuários, congregações |
| `/admin/congregations` | `app/admin/congregations/page.tsx` | AuthGuard + role ADMIN | Gerenciar congregações |

### 9.2 Componentes principais

| Componente | Descrição |
|-----------|-----------|
| `AuthGuard` | Proteção de rotas; refresh silencioso; exibe `AskNameModal` se sem nome |
| `MobileBottomNav` | Nav bar inferior com 5 itens (Início, Mapa, Nova, Pioneiro, Congregação/Admin) |
| `PushSubscriber` | Registra subscription push ao logar; recriar se VAPID key mudou |
| `ServiceWorkerRegister` | Registra o SW (`/sw.js`) |
| `AskNameModal` | Modal obrigatório para definir nome do usuário |
| `RevisitsMap` | Componente Leaflet (dynamic, ssr:false) — não importar diretamente em SSR |
| `RevisitEditModal` | Modal para editar/excluir uma revisita |
| `CreateTerritoryModal` | Modal 2-steps: (1) label+cor+tipo; (2) imagem ou ruas |
| `EditTerritoryModal` | Modal para editar ruas e casas de um território STREETS |
| `LocationPickerMap` | Mapa Leaflet para selecionar coordenadas |
| `CongregationRequestForm` | Formulário para solicitar entrar numa congregação |
| `InstallHomePrompt` | Prompt para instalar como PWA (A2HS) |

---

## 10. Fluxos Críticos — Passo a Passo

### 10.1 Autenticação
```
1. Usuário faz login → POST /api/auth/login
2. Server retorna { accessToken, refreshToken, role, congregationId, name }
3. Zustand persiste em localStorage
4. AuthGuard verifica token em cada página protegida
5. Em 401 → interceptor Axios faz POST /api/auth/refresh
6. Se refresh falhar → logout + /login?reason=session-expired
```

### 10.2 Solicitar Entrada em Congregação
```
1. Publicador sem congregação abre /congregations
2. Vê lista de congregações ACTIVE (GET /api/congregations/active)
3. Clica "Solicitar" → POST /api/congregations/[id]/join
4. API valida: usuário sem congregação, sem pedido PENDING, congregação ACTIVE
5. Cria CongregationJoinRequest (upsert — pode reativar REJECTED)
6. Dispara push para ANCIÃO + SERVO_DE_CAMPO da congregação + todos os ADMINs
   → usa notifyByRolesInCongregation (1 query)
7. Frontend exibe card de pedido pendente com opção "Cancelar"
```

### 10.3 Aprovar/Rejeitar Pedido
```
1. Ancião recebe notification push → abre /congregations
2. Vê seção "Solicitações de Entrada" com card do usuário
3. Clica "Aprovar" → PATCH /api/congregations/[id]/join/[requestId] { action: "approve" }
4. API seta status = APPROVED + user.congregationId = congregationId
5. Clica "Recusar" → mesmo PATCH com { action: "reject", reason?: string }
6. API seta status = REJECTED
```

### 10.4 Compartilhar Território
```
1. ANCIAO/SERVO/ADMIN abre /congregations/territories/[id]
2. Clica botão compartilhar → abre modal de confirmação
3. ADMIN pode escolher público-alvo (congregação / todos / só admins)
4. Clica "Compartilhar" → POST /api/territories/[id]/share { target }
5. API atualiza lastSharedAt + dispara push notification
6. Frontend aguarda resposta da API
7. Abre navigator.share() nativo (ou wa.me como fallback)
8. APÓS fechar o diálogo nativo → exibe toast de confirmação
   ⚠️ Toast é exibido DEPOIS do navigator.share() resolver — não antes
```

### 10.5 Registrar Visita a uma Casa
```
1. Usuário abre território → expande rua → clica em uma casa
2. Abre VisitModal (bottom sheet)
3. Clica "Atendeu" (OK) ou "Não Bater" (FAIL)
4. POST /api/territories/[id]/visit { houseId, status }
5. Frontend atualiza localmente via setTerritory (sem reload)
```

### 10.6 Botão Voltar em Links Externos
```
Problema: links compartilhados via push/WhatsApp abrem sem histórico de navegação
Solução (handleBack em territories/[id]/page.tsx):
  - se window.history.length > 2 → router.back()
  - se não → router.push("/home")
```

---

## 11. Identidade Visual

| Token | Valor |
|-------|-------|
| Primary | `#4a6da7` |
| Primary Dark | `#3b5998` |
| Accent | `#c18f59` |
| Background | gradiente `#2f4778 → #3b5998 → #4a6da7 → #6e8ec2` |
| Cards | `background: #fff`, `box-shadow: var(--shadow-soft)` |
| Border | `var(--color-border)` |
| Text light | `var(--color-text-light)` |

---

## 12. Regras de Deployment

- Dependências que devem ficar em `dependencies` (não devDependencies): `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `@types/web-push`, `dotenv`
- `eslint: { ignoreDuringBuilds: true }` no `next.config.ts` — ESLint não instalado com `--omit=dev`
- CSP em `next.config.ts`: report-only no dev e enforcement em produção
- Migrations rodadas com `npx prisma migrate deploy` (nunca `migrate dev` em produção)
- Service Worker: ao mudar `CACHE_NAME`, usuários recebem novo SW no próximo acesso
- Deploy seguro precisa aplicar migrations antes do restart e validar `/api/auth/login` localmente para detectar erro de schema imediatamente

**Deploy recomendado:**
```powershell
& "C:\Program Files\PuTTY\plink.exe" -batch -pw $env:VPS_SENHA "$env:VPS_USER@$env:VPS_IP" `
  "cd /var/www/pregadores && bash atualizar-vps.sh"
```

Evitar em produção:
- `npm install --omit=dev` antes de build e migration, porque o fluxo usa Prisma CLI e precisa do ambiente completo de build
- restart manual sem smoke test mínimo após migration/build

---

## 13. Backlog

- [ ] **Admin — Simular visão de Ancião e Publicador** — alternar perspectiva para testar experiência
- [ ] **Remodelar a Página Inicial (Home)** — redesenhar layout, cards e informações
- [ ] **Novas features em Congregação** — anúncios, agenda, relatórios (a definir)

---

## 14. Pontos de Atenção Antes de Mexer

| Área | O que verificar |
|------|----------------|
| Autenticação | `AuthPayload` tem apenas `userId` + `role`. Para `congregationId`, buscar no banco. |
| Roles | Checar a hierarquia antes de definir permissões novas |
| Push | Sempre tratar erros de push como não-críticos (não bloquear a resposta da API) |
| CSP | Em produção, qualquer novo recurso client-side externo precisa entrar explicitamente na policy antes do deploy |
| Leaflet / Mapas | Carregar com `dynamic(..., { ssr: false })` — nunca importar diretamente |
| `router.back()` | Em páginas acessíveis por link externo, usar `handleBack` com fallback para `/home` |
| Toast após `navigator.share()` | Exibir APÓS `await navigator.share()` resolver, não antes |
| Migrations | Sempre criar migração nova; nunca editar migração já aplicada em produção |
| `PioneerReport.date` | Formato `"YYYY-MM-DD"` (string), não DateTime |
| `House.id` / `Street.id` | UUIDs vindos do Firestore — não alterar estratégia de ID |
| Subscriptions push | `upsert` por `endpoint` — não criar duplicatas |
