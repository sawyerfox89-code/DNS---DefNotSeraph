# Economy Balance Simulator

## Quick Start

```bash
node tools/balance-sim.js
```

Simulates 30 days of gameplay for all 9 company types with an "optimal-ish" hiring/expansion strategy. No dependencies — runs standalone with inline config extracted from `src/config.js`.

## What It Models

- **Starting state**: $10,000 cash, reputation 35, starting rooms + 1 agent per room
- **Hiring schedule**: 1 new agent every 3 days, cycling through delivery and growth offices
- **Room expansion**: auto-builds rooms when hiring into new office types
- **Daily costs**: room upkeep + agent salaries
- **Revenue streams**:
  - Project completions (delivery/growth agents, weighted by office role)
  - Walk-in customer sales (fashion_retail with walkinMultiplier)
  - MRR growth (SaaS/exponential models)
  - Organic funnel (reputation-driven visitor pipeline)
- **Cost centers**: infrastructure offices (support, HR, finance, legal, IT, R&D, warehouse) have negative project pay — they cost money but provide passive bonuses
- **Infrastructure bonuses**: legal +15% project pay, IT +8% efficiency, finance (tracked)
- **Company bonuses**: projectPayMultiplier, reputationPayMultiplier, walkinMultiplier, organicMultiplier, hireCostDiscount, etc.
- **Reputation**: support agents increase it, absence decays it

## Output

1. **Summary table** — Day 10/20/30 profit, total revenue, reputation, valuation per company
2. **Cash balance chart** — Start vs end cash, min/max, bankruptcy warnings
3. **Fashion Store breakdown** — Detailed daily log (revenue, walk-in, costs, profit, cash, rep)
4. **Balance warnings** — Flags for bankruptcy, low revenue, below-median performance

## Limitations

- Hiring schedule is fixed (every 3 days) — real players adapt to cash flow
- Revenue model is simplified (avg pay / avg time * weight) — doesn't model project queue, agent idle time, or multi-phase work
- Walk-in revenue is estimated from probability curves, not full visitor state machine
- No random events, loans, or strategic decisions modeled
- Infrastructure bonuses are approximated (actual game applies them differently per project)

## Keeping It Updated

When changing `src/config.js` values (project pay, salaries, room costs, company bonuses), update the corresponding inline constants at the top of `tools/balance-sim.js`. Key sections:

| Simulator Constant | Source in config.js |
|---|---|
| `AVG_PROJECT_PAY` | Average of `basePay` across `PROJECT_TEMPLATES` per office |
| `AVG_COST_PAY` | Average of negative `basePay` for `cost: true` templates per office |
| `AVG_PROJECT_TIME` | Average of `time` across `PROJECT_TEMPLATES` per office |
| `AGENT_SALARY` | Direct copy from config |
| `ROOM_COSTS` | Direct copy from config |
| `COMPANY_TYPES` | Subset — bonuses, available, startUnlocked |

## Economy Design Notes

### Revenue vs Cost Centers

Offices are categorized into three tiers:

- **Delivery** (weight 1.0) — core revenue-generating work (seo, engineering, shopfront, etc.)
- **Growth** (weight 0.3) — pipeline/funnel work that amplifies delivery (sales, marketing, pr)
- **Infrastructure** (weight 0.15) — cost centers with negative project pay but passive bonuses

Infrastructure offices never generate direct profit. Their value comes from passive effects:
- **Legal**: +15% pay on all completed projects
- **IT**: +8% global efficiency
- **Finance**: budget visibility (future feature)
- **HR**: reduced hiring costs, better candidates
- **Support**: reputation maintenance (prevents decay)
- **R&D**: breakthrough innovations, random pay multipliers

Players must decide when the passive bonus ROI justifies the ongoing cost.
