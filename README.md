<p align="center">
  <img src="public/banner.png" alt="DriftFix AI Banner" width="100%" />
</p>

<h1 align="center">
  <strong>DriftFix AI</strong>
</h1>
<p align="center">
  <strong>Shift-Left Compliance for Every Pull Request</strong><br/>
  AI-powered PR diff analysis &middot; SOC2 &middot; GDPR &middot; HIPAA<br/>
  Inline suggestions &middot; Evidence ledger &middot; Org-level dashboards
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/GitHub_Actions-Node20-2088FF?logo=githubactions&logoColor=white" alt="GitHub Actions" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## What is DriftFix AI?

DriftFix AI is a **compliance-as-code platform** that catches security and privacy violations **before they merge**. It analyzes pull request diffs against SOC2, GDPR, and HIPAA control requirements using a dual approach:

1. **YAML-driven rule engine** with 6 specialized detectors (regex secrets, Shannon entropy, PII field scanning, outbound HTTP allowlisting, CVE cross-referencing, audit annotation checking)
2. **LLM-powered AI review** that validates rule engine findings, catches missed issues, and maps violations to specific compliance controls

**BLOCKING** findings fail the GitHub check and prevent merge. **WARNING/INFO** findings are posted as inline PR comments with one-click suggested fixes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Pull Request                       │
└──────────────────────────┬──────────────────────────────────┘
                           │  diff webhook / action trigger
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              GitHub Action (Node.js 20)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Diff Parser  │→│ Rule Engine  │→│ GitHub Checks API │  │
│  │              │  │ (6 detectors)│  │  BLOCKING→fail   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│                    ┌─────────────┐                          │
│                    │  LLM Review │                          │
│                    │ (z-ai SDK)  │                          │
│                    └──────┬──────┘                          │
│                           ▼                                  │
│                  ┌─────────────────┐                        │
│                  │ PR Review API   │                        │
│                  │ Inline comments │                        │
│                  │ Suggested fixes │                        │
│                  └─────────────────┘                        │
└──────────────────────────┬──────────────────────────────────┘
                           │  findings, scores, evidence
                           ▼
┌─────────────────────────────────────────────────────────────┐
│             Next.js 16 Dashboard (Port 3000)                 │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐ │
│  │ Overview │ │ Findings │ │ Compliance│ │ Audit Trail  │ │
│  │  Gauge   │ │  Table   │ │  Trends   │ │ Evidence Led.│ │
│  └──────────┘ └──────────┘ └───────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐ │
│  │  Repos   │ │ Reports  │ │  Billing  │ │  Settings    │ │
│  └──────────┘ └──────────┘ └───────────┘ └──────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │ SQLite  │ │ Stripe  │ │ WebSocket    │
        │ (Prisma)│ │ Webhooks│ │ Notifications│
        └──────────┘ └──────────┘ └──────────────┘
```

---

## 7 Core Features

### 1. Severity Tiers (BLOCKING / WARNING / INFO)

Every compliance finding is classified into one of three tiers:

| Tier | GitHub Check | Merge Behavior | Example |
|------|-------------|----------------|---------|
| **BLOCKING** | `failure` | **Prevents merge** | Hardcoded API key, high-entropy secret |
| **WARNING** | `neutral` | Comment only | Unencrypted PII field, non-allowlisted HTTP call |
| **INFO** | `neutral` | Comment only | Missing audit log annotation |

The severity taxonomy lives in **`compliance-rules.yaml`** — fully configurable without touching code.

```yaml
# compliance-rules.yaml (excerpt)
tiers:
  BLOCKING:
    check_conclusion: failure
    description: "Prevents PR merge. Must be resolved."
  WARNING:
    check_conclusion: neutral
    description: "Posted as PR comment only."
  INFO:
    check_conclusion: neutral
    description: "Informational note posted as PR comment."
```

### 2. Expanded Pattern Library (6 Detectors)

| Detector | Technique | What It Catches |
|----------|-----------|----------------|
| **Secret Regex** | Pattern matching | API keys, DB URLs, passwords, tokens in code |
| **Secret Entropy** | Shannon entropy analysis | High-entropy strings (≥4.0) missed by regex |
| **PII Field** | Schema scanning + annotation check | Email, SSN, phone, credit card fields without `@Encrypted` |
| **Outbound HTTP** | Call extraction + allowlist | `fetch()`/`axios()` to non-allowlisted domains |
| **Dependency CVE** | Lockfile parsing + OSV.dev cross-reference | Known vulnerable package versions |
| **Audit Annotation** | Function body scanning | Sensitive operations without audit logging |

Each detector returns structured findings with confidence scores (0–1), framework citations, and suggested fixes.

### 3. One-Click Suggested Fixes

Every finding includes a **GitHub suggested-change** that developers can apply directly from the PR comment:

```
Suggested change:
```diff
- API_KEY = "sk_live_abc123def456"
+ API_KEY = process.env.API_KEY
```
```

Supported fix types:
- **Secret replacement** → `process.env.VAR_NAME`
- **PII encryption** → Add `@Encrypted` annotation
- **HTTP allowlist** → Add TODO comment with allowlist guidance
- **Audit logging** → Add `audit.log()` call

### 4. Audit Evidence Export

Generate tamper-evident compliance reports with:
- **Compliance score** (0–100, weighted by severity × confidence)
- **Findings breakdown** by tier, category, and framework
- **SHA-256 hash chain** — every evidence record links to the previous one
- **Approver info** and resolution status
- **Timestamped integrity hash** for verification

```
Evidence Chain Verification:
  GENESIS → SHA256(event1|actor1|...|GENESIS|t1)
           → SHA256(event2|actor2|...|hash1|t2)
           → ... (tamper-evident)
```

### 5. Framework Toggle (SOC2 / GDPR / HIPAA)

Switch compliance frameworks per-repository. Same detectors map to different control citations:

| Rule | SOC2 | GDPR | HIPAA |
|------|------|------|-------|
| Hardcoded Secret | CC6.1 — Logical Access | Art.32 — Security of Processing | §164.312(a)(1) — Access Control |
| Unencrypted PII | CC7.2 — Data Encryption | Art.25 — Data Protection by Design | §164.312(a)(2)(iv) — Encryption |
| Outbound HTTP | A1.2 — External Threats | Art.44-49 — Cross-Border Transfer | §164.312(e)(1) — Transmission Security |

Framework configs live in `frameworks/soc2.yaml`, `frameworks/gdpr.yaml`, `frameworks/hipaa.yaml`.

### 6. Org-Level Dashboard

Cross-repository compliance aggregation:
- **Compliance score gauge** with 12-week trend sparklines
- **Findings distribution** pie chart by severity
- **Per-repo breakdown** with framework, PR count, and score
- **Real-time notifications** via WebSocket (Socket.IO)
- **Unified audit log** combining findings, evidence, analyses, and PRs

### 7. Usage-Based Metering (Stripe)

| Plan | Price | PRs / Month | Repos |
|------|-------|-------------|-------|
| **Free** | $0 | 50 | 1 |
| **Pro** | $29/mo | Unlimited | Unlimited |
| **Enterprise** | Custom | Unlimited | Unlimited |

Overage: $0.50/PR. Full Stripe webhook integration for subscription lifecycle.

---

## Quick Start

### Prerequisites

- **Bun** (recommended) or Node.js 20+
- **Git**
- A GitHub personal access token (for the Action)

### 1. Clone & Install

```bash
git clone https://github.com/Bahati-bk/DriftFix-AI.git
cd DriftFix-AI
bun install
```

### 2. Set Up Database

```bash
bun run db:push
bun run db:generate
```

### 3. Seed Demo Data

```bash
bun run scripts/seed.ts
```

This creates a full demo environment with:
- Demo user: `demo@driftfix.ai` / `demo123`
- 4 repositories, 8 PRs, 12 findings
- 17 hash-chained evidence records
- 12-week compliance score history (62 → 87 improving trend)

### 4. Start the Dashboard

```bash
bun run dev
```

Open the preview panel or navigate to the app. Click **"Try Demo"** on the landing page.

### 5. Use the GitHub Action

Add to your `.github/workflows/compliance.yml`:

```yaml
name: DriftFix Compliance Check
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get PR diff
        id: diff
        run: |
          git fetch origin ${{ github.base_ref }}
          git diff origin/${{ github.base_ref }}...HEAD > diff.txt
          echo "diff<<EOF" >> $GITHUB_OUTPUT
          cat diff.txt >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: DriftFix Compliance Check
        id: driftfix
        uses: Bahati-bk/DriftFix-AI/github-action@main
        with:
          diff: ${{ steps.diff.outputs.diff }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          framework: soc2  # soc2 | gdpr | hipaa

      - name: Check result
        if: steps.driftfix.outputs.check_conclusion == 'failure'
        run: |
          echo "❌ BLOCKING findings detected! PR cannot merge."
          echo "  Blocking: ${{ steps.driftfix.outputs.blocking_count }}"
          echo "  Warning:  ${{ steps.driftfix.outputs.warning_count }}"
          echo "  Info:     ${{ steps.driftfix.outputs.info_count }}"
          exit 1
```

---

## Project Structure

```
DriftFix-AI/
├── compliance-rules.yaml          # Master rule config (7 rules, 3 tiers)
├── frameworks/                    # Per-framework rule subsets
│   ├── soc2.yaml
│   ├── gdpr.yaml
│   └── hipaa.yaml
├── github-action/                 # Reusable GitHub Action
│   ├── action.yml                 # Action metadata (inputs/outputs)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/index.ts               # Action entry point
├── src/
│   ├── app/                       # Next.js 16 App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/                   # 25+ API endpoints
│   │       ├── analyze-diff/      # Core rule engine API
│   │       ├── audit-export/      # Evidence export
│   │       ├── billing/           # Usage-based metering
│   │       ├── org-dashboard/     # Cross-repo aggregation
│   │       ├── rules-config/      # YAML rule config API
│   │       ├── stripe/webhook/    # Stripe lifecycle
│   │       └── ...
│   ├── components/
│   │   ├── dashboard/             # 15 view components
│   │   │   ├── OverviewView.tsx   # Score gauge, sparklines, charts
│   │   │   ├── DiffAnalyzerView.tsx # Interactive diff analysis
│   │   │   ├── FindingsView.tsx   # Filterable findings table
│   │   │   ├── ComplianceView.tsx # 12-week trend charts
│   │   │   ├── EvidenceView.tsx   # Hash-chained ledger
│   │   │   ├── OrgDashboardView.tsx # Cross-repo dashboard
│   │   │   └── ...
│   │   ├── landing/               # Marketing landing page
│   │   └── ui/                    # 45+ shadcn/ui components
│   ├── lib/
│   │   ├── rule-engine/           # Core compliance engine
│   │   │   ├── engine.ts          # analyzeDiff() orchestrator
│   │   │   ├── config-loader.ts   # YAML loader + validator
│   │   │   ├── diff-parser.ts     # Unified diff parser
│   │   │   ├── types.ts           # Full type system
│   │   │   ├── detectors/         # 6 specialized detectors
│   │   │   │   ├── secret-regex-detector.ts
│   │   │   │   ├── secret-entropy-detector.ts
│   │   │   │   ├── pii-field-detector.ts
│   │   │   │   ├── outbound-http-detector.ts
│   │   │   │   ├── dependency-cve-detector.ts
│   │   │   │   └── audit-annotation-detector.ts
│   │   │   └── __tests__/         # 17 tests with fixtures
│   │   ├── ai/provider.ts         # LLM analysis (z-ai SDK)
│   │   ├── compliance/
│   │   │   ├── evidence.ts        # SHA-256 hash chain
│   │   │   ├── scoring.ts         # Weighted compliance score
│   │   │   └── rules.ts           # Rule definitions
│   │   └── db.ts                  # Prisma client
│   ├── hooks/                     # React hooks (toasts, mobile, WS)
│   └── stores/app.ts              # Zustand global state
├── mini-services/
│   └── ws-notifications/          # Real-time notification service (port 3005)
├── prisma/schema.prisma           # 20 data models
├── scripts/seed.ts                # Demo data seeder
└── public/
    ├── banner.png
    └── logo.svg
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16, React 19, TypeScript 5 | App Router, SSR, API routes |
| **UI** | Tailwind CSS 4, shadcn/ui, Radix UI, Framer Motion | Responsive design, animations, 45+ components |
| **State** | Zustand, TanStack Query | Client state, server state caching |
| **Database** | Prisma ORM, SQLite | 20 models, type-safe queries |
| **Charts** | Recharts | Score trends, severity breakdowns, sparklines |
| **Real-time** | Socket.IO | WebSocket notifications |
| **Auth** | NextAuth.js v4 | Session-based authentication |
| **AI** | z-ai-web-dev-sdk | LLM-powered compliance analysis |
| **GitHub Action** | Node.js 20, Octokit | Check runs, inline comments, suggested fixes |
| **Payments** | Stripe | Subscription billing, webhooks |
| **Forms** | React Hook Form + Zod | Type-safe form validation |
| **Theming** | next-themes | Light/dark mode |

---

## Rule Engine Deep Dive

### Processing Pipeline

```
PR Diff (unified format)
    │
    ▼
parseDiff() ──── DiffFile[] (files with typed lines + line numbers)
    │
    ▼
For each file × each rule:
    │
    ▼
detector.detect(file, rule, context) ──── RuleFinding[]
    │  • rule_id, severity, confidence
    │  • file, line_range, explanation
    │  • suggested_fix (GitHub diff format)
    │  • framework citations
    │
    ▼
Aggregate + Compute Summary
    │  • total, blocking, warning, info counts
    │  • files_scanned
    │  • check_conclusion: 'failure' | 'success'
    │
    ▼
AnalysisResult
```

### Detector Details

**Secret Regex** — Matches patterns like `API_KEY = "..."`, `PASSWORD = '...'`, connection strings. Skips test files and comments. Auto-generates `process.env.VAR_NAME` replacement.

**Secret Entropy** — Calculates Shannon entropy of string values in assignment patterns. Thresholds: ≥3.0 for 8+ char strings, ≥3.5 for shorter, ≥4.0 for standalone string literals. Dynamic confidence: `0.6 + entropy × 0.08`.

**PII Field** — Scans schema/model files for PII field names (email, ssn, phone, address, date_of_birth, credit_card, passport). Checks ±2 lines for encryption annotations (`@Encrypted`, `encrypted`, `cipher`, `aes`).

**Outbound HTTP** — Extracts URLs from `fetch()`, `axios()`, `http.*()` calls. Checks domain against configurable allowlist with wildcard support (`*.sentry.io`).

**Dependency CVE** — Parses lockfiles (package-lock.json, yarn.lock, requirements.txt, etc.). Cross-references against local CVE DB + OSV.dev API.

**Audit Annotation** — Detects functions with sensitive keywords (delete, payment, charge, login, admin, export). Scans next 20 lines for audit calls. If none found, flags as INFO.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze-diff` | Run rule engine on a diff, return findings |
| POST | `/api/analyses` | Full AI + rule engine analysis pipeline |
| GET | `/api/compliance` | Current compliance score + trends |
| GET | `/api/findings` | List findings (filterable, paginated) |
| POST | `/api/findings/[id]/resolve` | Resolve a finding |
| POST | `/api/findings/[id]/accept-risk` | Accept risk for a finding |
| GET | `/api/evidence` | Evidence ledger with chain verification |
| POST | `/api/reports/pdf` | Generate compliance report |
| GET | `/api/org-dashboard` | Cross-repo compliance metrics |
| GET | `/api/rules-config` | YAML rule configuration |
| GET/PUT | `/api/billing` | Billing info & plan management |
| POST | `/api/stripe/webhook` | Stripe subscription webhooks |
| GET | `/api/audit-log` | Unified activity feed |

---

## Database Schema (20 Models)

Key models: **User**, **Organization**, **Repository**, **PullRequest**, **AnalysisRun**, **Finding**, **ComplianceMapping**, **EvidenceRecord** (hash-chained), **AuditReport**, **Policy**, **Subscription**, **UsageRecord**, **ComplianceScoreHistory**

The **EvidenceRecord** model implements a blockchain-style hash chain where each record's hash = `SHA256(eventType | actor | payload | previousHash | timestamp)`, starting from `GENESIS`. Tampering with any record breaks the chain verification.

---

## Tests

**17 tests** covering 3 feature groups:

1. **Diff Parsing & Core Detectors** (8 tests) — Secret regex, PII, outbound HTTP, clean diffs, summary counts, check conclusions
2. **Advanced Detectors** (6 tests) — Entropy analysis, CVE detection, audit annotation scanning
3. **Suggested Fixes** (3 tests) — GitHub diff format for secrets, PII, and HTTP findings

Run tests:

```bash
bun run src/lib/rule-engine/__tests__/engine.test.ts
```

---

## Demo Credentials

| Field | Value |
|-------|-------|
| Email | `demo@driftfix.ai` |
| Password | `demo123` |
| Organization | Acme Corp |

Or click **"Try Demo"** on the landing page for instant access.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ by <strong>DriftFix Team</strong><br/>
  <em>Shift-Left Compliance. Every PR. Every Framework.</em>
</p>
