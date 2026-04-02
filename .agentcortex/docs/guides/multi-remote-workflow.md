# AgentCortex Multi-Remote Workflow Guide

This guide explains how to manage **AgentCortex** (Stable A) and **AgentCortex-Next** (Experimental B/C) using a dual-remote Git setup.

## 📡 Remote Configuration

Your local repository is linked to two remotes:

- **`origin`**: `https://github.com/KbWen/AgentCortex.git` (Stable Production)
- **`next`**: `https://github.com/KbWen/AgentCortex-Next.git` (Experimental/Future)

## 🌿 Branching Strategy

- **`master`**: Points to `origin/master`. Used for A1, A2 stability fixes.
- **`feature/v4-experimental`**: Points to `next/feature/v4-experimental`. Used for major B -> C evolution.

---

## 🔄 Synchronization Workflows

### 1. Syncing Fixes from Stable (A) to Experimental (B)

When you fix a bug in `master` and want to bring it into your future version:

```bash
git checkout feature/v4-experimental
git fetch origin
git merge origin/master
git push next feature/v4-experimental
```

### 2. Promoting Experimental (C) to Stable (A)

When your future version is ready to become the new official `AgentCortex`:

```bash
git checkout master
git fetch next
git merge next/feature/v4-experimental
git push origin master
```

### 3. Deploying to New Projects

If you want to deploy the **Experimental** version to a project:

```bash
git checkout feature/v4-experimental
./deploy_brain.sh /path/to/target-project
```

---

## 🤖 Guidance for AI Agents

When an AI is working on this repo:

- **Identify the Scope**: Ask the user: "Am I working on stable fixes (origin) or future evolution (next)?"
- **State the Remote**: In every `/ship` command, clearly state which remote you are pushing to.
- **Cross-Seed**: If a fix is universally beneficial, proactively suggest syncing it across remotes.

---
*Maintained by AgentCortex Governance v3.5.3*
