---
name: frontend-review
description: Audita o frontend Angular buscando violações de boas práticas do projeto. Use sempre que o usuário pedir code review, auditoria, revisão de código, ou verificação de qualidade do frontend Angular/TypeScript.
argument-hint: "[pasta ou arquivo opcional]"
allowed-tools: Read, Grep, Glob, Bash(wc *)
---

# Auditoria de Boas Práticas Frontend

Analise o código Angular em `frontend/src/app/` (ou o caminho em `$ARGUMENTS` se fornecido) e reporte violações das regras abaixo.

## Regras de Estrutura de Componentes

1. **Sem template/styles inline grandes** — Se `template:` ou `styles:` no decorator `@Component` tiver mais de 15 linhas, deve ser extraído para `.html` e `.scss` separados usando `templateUrl` e `styleUrl`.
2. **Arquivo por responsabilidade** — Cada componente deve ter seus arquivos `.ts`, `.html`, `.scss`. Services e interfaces podem ficar no mesmo `.ts` do componente apenas se forem pequenos (< 30 linhas) e acoplados (ex: `ConfirmDialogService` + `ConfirmDialogComponent`).
3. **Standalone components** — Todos os componentes devem usar `standalone: true`.

## Regras de Estilo CSS/SCSS

4. **Estilos globais no `styles.scss`** — Classes de layout global (`.modal-overlay`, `.modal`, `.btn`, `.g-*`) devem estar no `styles.scss` global, nunca duplicadas em componentes.
5. **Estilos de componente no `.scss` próprio** — Estilos específicos (`.diver-view__*`, `.pcp__*`) ficam no SCSS do componente.
6. **Usar design tokens** — Sempre usar variáveis de `tokens` (`$text-primary`, `$accent`, `$bg-surface`, etc). Nunca hardcoded colors exceto em casos específicos como toast colors com dark/light theme.
7. **BEM naming** — Usar BEM: `.block__element--modifier`. Sem classes genéricas soltas.

## Regras de i18n

8. **Sem strings hardcoded** — Todo texto visível ao usuário deve vir do sistema i18n (`this.i18n.t()`). Exceção: placeholders numéricos como "170", "70".
9. **Tipagem de locale** — Toda nova chave i18n deve existir em `locale.ts` (tipo), `pt-BR.ts` e `en-US.ts`.

## Regras de Qualidade

10. **Sem hacks** — Proibido `setTimeout` para resolver problemas de timing, `any` desnecessário, `!important` em CSS.
11. **Componentes reutilizáveis** — Se o mesmo padrão de UI aparece em 2+ lugares, deve ser um componente shared.
12. **Preços inteiros** — Valores monetários são inteiros em reais, sem centavos.
13. **ViewEncapsulation padrão** — Usar `Emulated` (default). `None` apenas se justificado.
14. **OnPush obrigatório** — Todo componente deve usar `ChangeDetectionStrategy.OnPush`. Nunca `detectChanges()`, sempre `markForCheck()`.
15. **Signals para estado** — StateService com signals para cache HTTP. Computed signals para derivações. Nunca `.toPromise()`, sempre `firstValueFrom()`.
16. **takeUntilDestroyed** — Todo `.subscribe()` deve ter `takeUntilDestroyed(this.destroyRef)` pipe. Nunca manual unsubscribe.

## Regras de Testes

17. **Cobertura obrigatória** — Todo service novo deve ter `.spec.ts`. Rodar `cd frontend && npx jest` e garantir 100% green. Specs existentes: auth.service, diver.service, master.service, sailor.service, partner.service, theme.service, auth.guard, onboarding.guard, role.guard, error.interceptor, currency-mask.directive, scroll-lock.directive, auth-callback.container.
18. **HttpTestingController** — Testes de service usam `provideHttpClient()` + `provideHttpClientTesting()`. Verificar método HTTP, URL e payload. Sempre `httpMock.verify()` no afterEach.
19. **Guards testados** — Testar `CanActivateFn` com `TestBed.runInInjectionContext()`. Mock AuthService signals, verificar UrlTree de redirect.
20. **Interceptors testados** — Testar error interceptor com `throwError()` + status codes. Verificar que toasts corretos são disparados.
21. **Directives testadas** — Usar TestHostComponent com template inline. CurrencyMask: testar writeValue(0/null/N), beforeinput events. ScrollLock: testar backdropClose mobile/desktop.
22. **Zoneless testing** — Setup usa `setupZonelessTestEnv()` (jest-preset-angular). Sem Zone.js.

## Regras de E2E (Playwright)

23. **Catálogo de cenários** — Todos os cenários E2E estão documentados em `e2e/TEST_SCENARIOS.md` (135 cenários, 14 módulos). Novos cenários devem ser adicionados ao catálogo.
24. **Page Object Model** — Usar POMs em `e2e/pages/`. Cada página tem seu POM com locators e ações.
25. **API seeding** — Dados de teste criados via `e2e/helpers/api.helper.ts` (login, createDiver, createEvent, etc). Nunca depender de dados pré-existentes.
26. **Bug regressions** — Bugs corrigidos devem ter teste em `e2e/tests/bug-regressions.spec.ts`. Cenários na seção 14 do catálogo.

## Formato de Saída

Para cada violação encontrada, reporte:

```
❌ [REGRA N] arquivo:linha — Descrição breve
   Sugestão: como corrigir
```

No final, dê um resumo:
- Total de violações por categoria
- Nota geral (A-F)
- Top 3 prioridades de correção
