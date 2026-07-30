---
title: AVO-190 Soak Target Identity
status: frozen
classification: quick-win
primary_domain: ci-infra
---

# AVO-190 Soak Target Identity

## Problem

The soak tools currently trust an HTTP 2xx response or a hardcoded `:5173` origin. They can therefore sample another application and report invalid evidence.

## Contract

- A reusable target must expose `/src/systems/store.js` and contain the stable AVO markers `useOfficeStore` and `applyExternalStatus`.
- `SOAK_URL` and an occupied default `:5173` must fail closed when the identity probe responds but does not match.
- An unreachable default `:5173` may fall back to spawning the dedicated Vite server; an explicit unreachable `SOAK_URL` must fail.
- `overlap-recorder` uses the same probe and accepts `SOAK_URL`, defaulting to `http://localhost:5173`.
- Errors name the rejected URL and include `target identity check failed` before Playwright sampling begins.

## Acceptance Criteria

1. Generic HTTP 200 content is rejected.
2. A Vite-served AVO store module is accepted.
3. Missing, invalid, and non-2xx probe outcomes are classified deterministically.
4. Spawned soak remains functional and no product-runtime files change.

## Domain Decisions

- [DECISION] CI-infra target reuse is permitted only after a shared, fail-closed source-module identity probe; only an explicit connection refusal on the default origin may trigger the spawn fallback.

## Non-goals

- No soak invariant, movement, browser, or product UI refactor.
- No process ownership or port-discovery redesign.
