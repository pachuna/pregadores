---
name: ui-ux-review
description: Audita UI/UX do frontend Angular verificando consistencia visual, acessibilidade e responsividade. Use sempre que o usuario pedir review de design, analise de layout, verificacao visual, auditoria de acessibilidade, ou revisao de interface e experiencia do usuario.
argument-hint: "[componente ou pagina opcional]"
allowed-tools: Read, Grep, Glob
---

# Auditoria UI/UX

Analise os templates HTML e SCSS em `frontend/src/app/` (ou o caminho em `$ARGUMENTS` se fornecido) e reporte problemas de UI/UX.

## Design System & Consistencia

1. **Design tokens obrigatorios** — Todas as cores, espacamentos, bordas e sombras devem usar tokens de `theme/tokens`. Nunca hardcoded hex/rgb exceto em casos justificados (ex: toast colors com tema dual).
2. **Componentes padrao** — Usar os componentes shared do projeto: `app-dropdown`, `app-phone-country-picker`, `app-confirm-dialog`, `app-toast`, `app-diver-modal`. Nunca reimplementar.
3. **Botoes consistentes** — Usar classes `btn btn--primary`, `btn--secondary`, `btn--ghost`, `btn--danger`, `btn--sm`. Nunca estilizar `<button>` diretamente.
4. **Formularios consistentes** — Usar classes `g-form`, `g-row`, `g-field`, `g-label`, `g-input`, `g-toggles`. Nunca criar estilos de form isolados.
5. **Modais consistentes** — Usar classes globais `modal-overlay`, `modal`, `modal--wide`, `modal__header`, `modal__form`, `modal__actions`. Nunca criar overlay/modal custom.

## Responsividade

6. **Mobile-first** — Breakpoints: `480px` (mobile), `768px` ($bp-md, tablet), `1024px` (desktop). Usar `@media (min-width:)` para progressive enhancement.
7. **Touch targets** — Botoes e links clicaveis devem ter no minimo 44x44px de area de toque em mobile.
8. **Sem overflow horizontal** — Nenhum componente deve causar scroll horizontal em telas < 375px. Verificar tabelas, grids e textos longos.
9. **Grids responsivos** — `g-row` (2 colunas) e `g-row--3` (3 colunas) devem colapsar para 1 coluna em mobile. Verificar se ha `@media` adequado no global styles.

## Acessibilidade (a11y)

10. **Labels em inputs** — Todo `<input>`, `<select>`, `<textarea>` deve ter um `<label>` associado (via `for`/`id` ou wrapping).
11. **Alt em imagens** — Toda `<img>` deve ter atributo `alt` descritivo.
12. **Aria labels** — Botoes com apenas icone (ex: fechar modal `✕`) devem ter `aria-label`.
13. **Contraste** — Texto deve ter contraste minimo 4.5:1 contra o fundo. Verificar especialmente `--text-secondary` sobre `--bg-surface`.
14. **Focus visible** — Elementos interativos devem ter `:focus-visible` styling. Nunca `outline: none` sem alternativa.

## Feedback & UX

15. **Loading states** — Toda acao assincrona (salvar, carregar, deletar) deve mostrar feedback visual (spinner, disabled button, skeleton).
16. **Empty states** — Listas vazias devem mostrar mensagem amigavel, nunca ficar em branco.
17. **Error feedback** — Erros de API devem mostrar toast com mensagem util. Nunca falhar silenciosamente.
18. **Confirmacao destrutiva** — Acoes destrutivas (deletar, remover) devem usar `ConfirmDialogService`. Nunca deletar sem confirmacao.
19. **Scroll lock** — Modais devem usar directive `scrollLock` para impedir scroll do body.

## Formato de Saida

Para cada problema encontrado:

```text
⚠️ [REGRA N] arquivo:linha — Descricao do problema
   Impacto: [baixo|medio|alto] — Por que isso afeta o usuario
   Sugestao: como corrigir
```

No final:
- Total por categoria (Design System, Responsividade, Acessibilidade, UX)
- Nota geral (A-F)
- Top 3 quick wins (correcoes de alto impacto e baixo esforco)
