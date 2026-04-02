# Flutter/Dart Engineering Template

Flutter and Dart project-wide conventions for any project using AgentCortex.
These rules extend `engineering_guardrails.md` and are **non-negotiable**.

> **Load order**: `AGENTS.md` → `engineering_guardrails.md` → this file → project-specific rules

---

## 1. Riverpod State Management

- **MUST** use `StateNotifier` + `StateNotifierProvider`. Bare `ChangeNotifier` is **strictly prohibited**.
- CRUD operations MUST propagate state changes via `ref.invalidate()` or explicit `state = newState`. Silent in-place mutations without notifying the provider = **Gate FAIL**.
- Widget tree MUST NOT call DB/storage layer directly. All DB access MUST go through a Provider or Repository layer. A widget importing a DAO directly = **Review Gate FAIL**.

## 2. Domain Model Conventions

- Every domain Model class (non-ORM) MUST implement `copyWith()`. Missing `copyWith` = **Review Gate FAIL**.
- ORM ↔ domain Model conversions MUST use explicit named methods (e.g., `fromCompanion()`, `toCompanion()`). Implicit casting or field-by-field spread at the call site is prohibited.
  *(See also: `engineering_guardrails.md` §1.2 — Explicit Over Implicit)*

## 3. Error Handling

- Provider / StateNotifier layer MUST surface errors via `AsyncValue`. Calling `throw` directly from a StateNotifier or Provider = **Gate FAIL**.
- Every `catch` block MUST include at minimum `debugPrint(e.toString())`.
  *(No-logging catch rule also enforced by `engineering_guardrails.md` §5.2)*

## 4. Import Style

- Same-project source imports MUST use `package:<project_name>/…` style. Relative cross-directory imports in non-test files are **prohibited**.
- **Exception**: files under `test/` may use relative imports within the `test/` directory tree.

## 5. Internationalisation (i18n)

- Hardcoded display strings (any language) in the Widget / UI layer are **prohibited** = **Review Gate FAIL**.
- All user-visible text MUST be accessed via `AppLocalizations.of(context)!.xxx`.
- ARB keys MUST use lowerCamelCase and describe semantic meaning, not screen location
  (e.g., `streakDaysLabel` ✅, `todayScreenLine3` ❌).

## 6. Testing

- `flutter test` MUST report all-pass before any Ship gate. Failing tests = **Ship Gate FAIL**.
  *(Per-service/provider test coverage requirement: `engineering_guardrails.md` §5.1)*
