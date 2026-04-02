---
name: frontend-review
description: Audita o frontend Angular buscando violacoes de boas praticas do projeto. Use sempre que o usuario pedir code review, auditoria, revisao de codigo, ou verificacao de qualidade do frontend Angular/TypeScript.
argument-hint: "[pasta ou arquivo opcional]"
allowed-tools: Read, Grep, Glob, Bash(wc *)
---

# Auditoria de Boas Praticas Frontend

Analise o codigo Angular em `frontend/src/app/` (ou o caminho em `$ARGUMENTS` se fornecido) e reporte violacoes das regras abaixo.

## Regras de Estrutura de Componentes

1. **Sem template/styles inline grandes** — Se `template:` ou `styles:` no decorator `@Component` tiver mais de 15 linhas, deve ser extraido para `.html` e `.scss` separados usando `templateUrl` e `styleUrl`.
2. **Arquivo por responsabilidade** — Cada componente deve ter seus arquivos `.ts`, `.html`, `.scss`. Services e interfaces podem ficar no mesmo `.ts` do componente apenas se forem pequenos (< 30 linhas) e acoplados (ex: `ConfirmDialogService` + `ConfirmDialogComponent`).
3. **Standalone components** — Todos os componentes devem usar `standalone: true`.

## Regras de Estilo CSS/SCSS

4. **Estilos globais no `styles.scss`** — Classes de layout global (`.modal-overlay`, `.modal`, `.btn`, `.g-*`) devem estar no `styles.scss` global, nunca duplicadas em componentes.
5. **Estilos de componente no `.scss` proprio** — Estilos especificos (`.diver-view__*`, `.pcp__*`) ficam no SCSS do componente.
6. **Usar design tokens** — Sempre usar variaveis de `tokens` (`$text-primary`, `$accent`, `$bg-surface`, etc). Nunca hardcoded colors exceto em casos especificos como toast colors com dark/light theme.
7. **BEM naming** — Usar BEM: `.block__element--modifier`. Sem classes genericas soltas.

## Regras de i18n

8. **Sem strings hardcoded** — Todo texto visivel ao usuario deve vir do sistema i18n (`this.i18n.t()`). Excecao: placeholders numericos como "170", "70".
9. **Tipagem de locale** — Toda nova chave i18n deve existir em `locale.ts` (tipo), `pt-BR.ts` e `en-US.ts`.

## Regras de Qualidade

10. **Sem hacks** — Proibido `setTimeout` para resolver problemas de timing, `any` desnecessario, `!important` em CSS.
11. **Componentes reutilizaveis** — Se o mesmo padrao de UI aparece em 2+ lugares, deve ser um componente shared.
12. **Precos inteiros** — Valores monetarios sao inteiros em reais, sem centavos.
13. **ViewEncapsulation padrao** — Usar `Emulated` (default). `None` apenas se justificado.
14. **OnPush obrigatorio** — Todo componente deve usar `ChangeDetectionStrategy.OnPush`. Nunca `detectChanges()`, sempre `markForCheck()`.
15. **Signals para estado** — StateService com signals para cache HTTP. Computed signals para derivacoes. Nunca `.toPromise()`, sempre `firstValueFrom()`.
16. **takeUntilDestroyed** — Todo `.subscribe()` deve ter `takeUntilDestroyed(this.destroyRef)` pipe. Nunca manual unsubscribe.

## Regras de Testes

17. **Cobertura obrigatoria** — Todo service novo deve ter `.spec.ts`. Rodar `cd frontend && npx jest` e garantir 100% green. Specs existentes: auth.service, diver.service, master.service, sailor.service, partner.service, theme.service, auth.guard, onboarding.guard, role.guard, error.interceptor, currency-mask.directive, scroll-lock.directive, auth-callback.container.
18. **HttpTestingController** — Testes de service usam `provideHttpClient()` + `provideHttpClientTesting()`. Verificar metodo HTTP, URL e payload. Sempre `httpMock.verify()` no afterEach.
19. **Guards testados** — Testar `CanActivateFn` com `TestBed.runInInjectionContext()`. Mock AuthService signals, verificar UrlTree de redirect.
20. **Interceptors testados** — Testar error interceptor com `throwError()` + status codes. Verificar que toasts corretos sao disparados.
21. **Directives testadas** — Usar TestHostComponent com template inline. CurrencyMask: testar writeValue(0/null/N), beforeinput events. ScrollLock: testar backdropClose mobile/desktop.
22. **Zoneless testing** — Setup usa `setupZonelessTestEnv()` (jest-preset-angular). Sem Zone.js.

## Regras de E2E (Playwright)

23. **Catalogo de cenarios** — Todos os cenarios E2E estao documentados em `e2e/TEST_SCENARIOS.md` (135 cenarios, 14 modulos). Novos cenarios devem ser adicionados ao catalogo.
24. **Page Object Model** — Usar POMs em `e2e/pages/`. Cada pagina tem seu POM com locators e acoes.
25. **API seeding** — Dados de teste criados via `e2e/helpers/api.helper.ts` (login, createDiver, createEvent, etc). Nunca depender de dados pre-existentes.
26. **Bug regressions** — Bugs corrigidos devem ter teste em `e2e/tests/bug-regressions.spec.ts`. Cenarios na secao 14 do catalogo.

## Formato de Saida

Para cada violacao encontrada, reporte:

```text
❌ [REGRA N] arquivo:linha — Descricao breve
   Sugestao: como corrigir
```

No final, de um resumo:
- Total de violacoes por categoria
- Nota geral (A-F)
- Top 3 prioridades de correcao
