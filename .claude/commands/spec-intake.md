# Claude Spec Intake Template

Use this when you have an existing spec (from another LLM, a document, or your own notes) and want to bring it into the project workflow.

```text
Please run /spec-intake behavior.
Spec source: <paste spec here, or give a file path, or describe in natural language>
```

## Examples

**Pasting a spec directly:**
```text
Please run /spec-intake behavior.
Spec source:
  # User Authentication
  Goal: Allow users to sign in with Google OAuth and email/password.
  AC:
  1. User can sign in with Google
  2. User can sign in with email + password
  3. Session persists across page reloads
```

**Referencing a file:**
```text
Please run /spec-intake behavior.
Spec source: docs/specs/draft-product-spec.md
```

**Natural language (product early stage):**
```text
Please run /spec-intake behavior.
Spec source: 我要做一個任務管理系統，有用戶系統、任務 CRUD、標籤分類、還有通知功能
```

## What the AI will do

1. Read and parse the spec in whatever format you gave it
2. If it's a large product spec → extract all features, show you a list, ask which to start with
3. Generate a proper `docs/specs/<feature>.md` with quality assessment
4. Flag anything it inferred (you confirm or correct)
5. Freeze the spec and run bootstrap automatically

No reformatting required from you.
