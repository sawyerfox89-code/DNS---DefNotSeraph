#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  Business Tycoon — Economy Balance Simulator
//  Simulates first 30 days of each company type with optimal play
//  Run: node tools/balance-sim.js
// ═══════════════════════════════════════════════════════════════

// ─── Inline config (extracted from src/config.js) ─────────────
const ECONOMY = {
  base_cpc: 2.50,
  base_website_cr: 0.03,
  base_close_rate: 0.15,
  sales_capacity_per_eff: 0.5,
  no_sales_capacity: 0.02,
  marketing_power_divisor: 220,
  delivery_gtm_ratio: 0.5,
  reputation_organic_factor: 2.0,
  starting_reputation: 35,
  grace_period_days: 7,
  content_organic_factor: 20,
  seo_organic_factor: 15,
  design_quality_cr_boost: 1.5,
  content_quality_cr_boost: 1.0,
  meeting_room_close_boost: 1.2,
  day_ticks: 600,
  week_days: 5,
  sales_deal_bonus: 0.15,
  no_sales_flow_rate: 0.30,
  support_rep_decay: 0.3,
  support_rep_gain: 0.1,
};

const ROOM_COSTS = {
  seo: 25, content: 25, video: 35, design: 30, data: 40,
  support: 20, sales: 25, engineering: 40, workshop: 30,
  marketing: 35, pr: 25, hr: 15, finance: 20, legal: 25,
  it: 35, rd: 45, warehouse: 10, shopfront: 20,
  breakroom: 10, meeting: 15, lobby: 0,
};

const AGENT_SALARY = {
  ceo: 0, seo_analyst: 80, content_writer: 70, video_creator: 90,
  designer: 85, data_analyst: 95, support_agent: 60, sales_rep: 75,
  engineer: 100, craftsman: 75, marketer: 85, pr_specialist: 80,
  hr_manager: 65, accountant: 70, lawyer: 90, it_admin: 80,
  researcher: 95, warehouse_mgr: 55, shop_assistant: 65,
};

const AGENT_ROLES = {
  seo_analyst:    { office: 'seo' },
  content_writer: { office: 'content' },
  video_creator:  { office: 'video' },
  designer:       { office: 'design' },
  data_analyst:   { office: 'data' },
  support_agent:  { office: 'support' },
  sales_rep:      { office: 'sales' },
  engineer:       { office: 'engineering' },
  craftsman:      { office: 'workshop' },
  marketer:       { office: 'marketing' },
  pr_specialist:  { office: 'pr' },
  hr_manager:     { office: 'hr' },
  accountant:     { office: 'finance' },
  lawyer:         { office: 'legal' },
  it_admin:       { office: 'it' },
  researcher:     { office: 'rd' },
  warehouse_mgr:  { office: 'warehouse' },
  shop_assistant: { office: 'shopfront' },
};

// Map office -> role key
const OFFICE_TO_ROLE = {};
for (const [key, val] of Object.entries(AGENT_ROLES)) {
  OFFICE_TO_ROLE[val.office] = key;
}

const COMPANY_TYPES = {
  digital_agency: {
    name: 'Digital Agency', icon: '🏢',
    available: ['seo','content','video','design','data','sales','support','marketing','pr','hr','finance','legal','it'],
    startUnlocked: ['lobby','seo','content','support'],
    bonuses: { organicMultiplier: 1.2 },
  },
  saas_startup: {
    name: 'SaaS Startup', icon: '🚀',
    available: ['engineering','design','content','data','sales','support','marketing','it','rd','hr','finance','legal'],
    startUnlocked: ['lobby','engineering','support'],
    bonuses: { projectPayMultiplier: 0.7, organicMultiplier: 0.5 },
  },
  ecommerce: {
    name: 'Online Store', icon: '🛒',
    available: ['marketing','design','content','sales','support','warehouse','data','pr','hr','finance','it','legal'],
    startUnlocked: ['lobby','sales','warehouse','support'],
    bonuses: { marketingEfficiency: 1.3, bulkOrderChance: 0.12 },
  },
  creative_house: {
    name: 'Creative House', icon: '🎭',
    available: ['design','video','content','seo','sales','pr','marketing','hr','finance','support'],
    startUnlocked: ['lobby','design','content','support'],
    bonuses: { reputationGainMultiplier: 1.5 },
  },
  tech_lab: {
    name: 'AI Lab', icon: '🤖',
    available: ['engineering','data','design','sales','support','it','rd','marketing','hr','finance','legal'],
    startUnlocked: ['lobby','engineering','data'],
    bonuses: { rdInnovationRate: 1.5, projectPayMultiplier: 1.2 },
  },
  maker_co: {
    name: 'Maker Co.', icon: '🏭',
    available: ['workshop','warehouse','engineering','design','sales','support','rd','hr','finance','legal','it'],
    startUnlocked: ['lobby','workshop','warehouse'],
    bonuses: { bulkOrderChance: 0.15, projectPayMultiplier: 1.1 },
  },
  consulting_firm: {
    name: 'Consulting Firm', icon: '🏛️',
    available: ['data','engineering','content','sales','pr','marketing','support','hr','finance','legal','it'],
    startUnlocked: ['lobby','data','content','support'],
    bonuses: { reputationPayMultiplier: 2.0, projectPayMultiplier: 1.1 },
  },
  staffing_agency: {
    name: 'Staffing Agency', icon: '🤝',
    available: ['hr','support','sales','marketing','pr','finance','legal','it','data','content'],
    startUnlocked: ['lobby','hr','support','sales'],
    bonuses: { hireCostDiscount: 0.5, founderDemandMultiplier: 2.5, placementFeeMultiplier: 1.3 },
  },
  fashion_retail: {
    name: 'Fashion Store', icon: '👗',
    available: ['shopfront','design','warehouse','sales','marketing','pr','support','hr','finance','legal','it','content'],
    startUnlocked: ['lobby','shopfront','warehouse'],
    bonuses: { walkinMultiplier: 3.0, organicMultiplier: 1.0 },
  },
};

const COMPANY_OFFICE_ROLES = {
  digital_agency:   { delivery: ['seo','content','video','design'],              growth: ['sales','marketing','pr'] },
  saas_startup:     { delivery: ['engineering','design'],                        growth: ['sales','content','marketing'] },
  ecommerce:        { delivery: ['sales','warehouse'],                           growth: ['marketing','content','design','pr'] },
  creative_house:   { delivery: ['design','video','content'],                    growth: ['sales','pr','marketing'] },
  tech_lab:         { delivery: ['engineering','data','rd'],                     growth: ['sales','marketing','design'] },
  maker_co:         { delivery: ['workshop','engineering','warehouse'],          growth: ['sales','design'] },
  consulting_firm:  { delivery: ['data','engineering','content'],               growth: ['sales','pr','marketing'] },
  staffing_agency:  { delivery: ['hr','support'],                               growth: ['sales','marketing','pr'] },
  fashion_retail:   { delivery: ['shopfront','design','warehouse'],             growth: ['sales','marketing','pr'] },
};

const OFFICE_ROLE_WEIGHTS = { delivery: 1.0, growth: 0.3, infrastructure: 0.15 };

const GROWTH_MODELS = {
  digital_agency:  { model: 'linear',      label: 'Linear' },
  saas_startup:    { model: 'exponential',  label: 'PLG' },
  ecommerce:       { model: 'physical',     label: 'Volume' },
  creative_house:  { model: 'linear',       label: 'Reputation' },
  tech_lab:        { model: 'exponential',  label: 'R&D-Led' },
  maker_co:        { model: 'physical',     label: 'Manufacturing' },
  consulting_firm: { model: 'premium',      label: 'Premium' },
  staffing_agency: { model: 'linear',       label: 'Placement' },
  fashion_retail:  { model: 'physical',     label: 'Retail' },
};

// Average project pay per office (from PROJECT_TEMPLATES)
// Revenue offices have positive avg pay, cost centers have negative
const AVG_PROJECT_PAY = {
  seo: 850, content: 800, video: 2150, design: 1850, data: 1500,
  sales: 1100, engineering: 2200, workshop: 1700,
  marketing: 1800, pr: 1200, shopfront: 900,
};

// Cost center offices — internal ops that cost money
const AVG_COST_PAY = {
  finance: -250, legal: -300, it: -350, rd: -550,
};

// Hybrid offices: cost center internally, revenue when in delivery role (clientFacing projects)
const HYBRID_OFFICES = {
  // { costPay, revenuePay } — cost projects always run, revenue projects only when delivery
  warehouse: { costPay: -200, revenuePay: 1233 }, // Fulfillment Service, Dropship Order, Logistics Consulting
  hr:        { costPay: -225, revenuePay: 2900 }, // Executive Search (3500), Talent Placement (2500), Workforce Planning (1800), C-Suite Placement (5500), Contract Staffing (1200)
  support:   { costPay: -150, revenuePay: 2133 }, // CS Outsource (2000), Help Desk Setup (1600), BPO Contract (2800) — avg
};

const AVG_PROJECT_TIME = {
  seo: 9.5, content: 9, video: 15, design: 14, data: 13,
  support: 7, sales: 10, engineering: 15, workshop: 15,
  marketing: 11, pr: 10, hr: 7, finance: 9, legal: 9,
  it: 11, rd: 15, warehouse: 7, shopfront: 9,
};

// ─── Simulation Engine ──────────────────────────────────────

function simulate(companyType) {
  const def = COMPANY_TYPES[companyType];
  const roles = COMPANY_OFFICE_ROLES[companyType];
  const gm = GROWTH_MODELS[companyType];
  const bonuses = def.bonuses || {};

  const startRooms = def.startUnlocked.filter(r => r !== 'lobby');

  // State
  let money = 10000;
  let totalRevenue = 0;
  let reputation = ECONOMY.starting_reputation;
  let productLevel = 0;

  // Build rooms: start rooms + hire schedule
  const rooms = ['lobby', ...startRooms];
  const agents = []; // { roleKey, salary, office, efficiency }

  // Hire initial agents for start rooms (day 0)
  for (const office of startRooms) {
    const roleKey = OFFICE_TO_ROLE[office];
    if (roleKey) {
      agents.push({
        roleKey,
        office,
        salary: AGENT_SALARY[roleKey] || 70,
        efficiency: 0.8 + Math.random() * 0.2,
      });
    }
  }

  // Hiring schedule: add 1 new agent every 3 days (realistic growth)
  const hireSchedule = [];
  const availableOffices = [...(roles.delivery || []), ...(roles.growth || [])];
  for (let i = 0; i < 40; i++) {
    const day = 3 + i * 3; // hire on day 3, 6, 9, ...
    const office = availableOffices[i % availableOffices.length];
    hireSchedule.push({ day, office });
  }

  // Daily tracking
  const dailyLog = [];
  const HIRE_COST = 800;
  const hireCostMult = bonuses.hireCostDiscount ? (1 - bonuses.hireCostDiscount) : 1.0;

  for (let day = 1; day <= 150; day++) {
    // ── Hiring ──
    for (const h of hireSchedule) {
      if (h.day === day) {
        const roleKey = OFFICE_TO_ROLE[h.office];
        if (roleKey && !rooms.includes(h.office)) {
          rooms.push(h.office);
          money -= (ROOM_COSTS[h.office] || 0) * 10; // rough build cost (not exact but ballpark)
        }
        if (roleKey) {
          agents.push({
            roleKey,
            office: h.office,
            salary: AGENT_SALARY[roleKey] || 70,
            efficiency: 0.7 + Math.random() * 0.3,
          });
          money -= HIRE_COST * hireCostMult;
        }
      }
    }

    // ── Daily Costs ──
    let roomCost = 0;
    for (const r of rooms) {
      if (r === 'lobby' && day <= ECONOMY.grace_period_days) continue;
      roomCost += ROOM_COSTS[r] || 0;
    }
    let salaryCost = agents.reduce((s, a) => s + a.salary, 0);
    const dailyCost = roomCost + salaryCost;
    money -= dailyCost;

    // ── Revenue: Project completions ──
    // Estimate based on active delivery agents
    let projectRevenue = 0;
    const deliveryOffices = roles.delivery || [];
    const growthOffices = roles.growth || [];

    let infraCosts = 0;
    for (const agent of agents) {
      const officeRole = deliveryOffices.includes(agent.office) ? 'delivery'
        : growthOffices.includes(agent.office) ? 'growth' : 'infrastructure';
      const weight = OFFICE_ROLE_WEIGHTS[officeRole] || 0.15;
      const avgTime = AVG_PROJECT_TIME[agent.office] || 10;

      // Pure cost center offices: operational costs only
      if (AVG_COST_PAY[agent.office] !== undefined) {
        const avgCost = AVG_COST_PAY[agent.office]; // negative
        infraCosts += (avgCost / avgTime) * weight;
        continue;
      }

      // Hybrid offices: cost center normally, mix of cost + revenue when in delivery role
      const hybrid = HYBRID_OFFICES[agent.office];
      if (hybrid) {
        if (officeRole === 'delivery') {
          // Mix of cost projects + client-facing revenue projects (~40/60 cost/revenue)
          const avgPay = hybrid.revenuePay * 0.6 + hybrid.costPay * 0.4;
          const qualityMult = 0.5 + agent.efficiency * 0.7;
          let payMult = bonuses.projectPayMultiplier || 1.0;
          // Placement fee multiplier for HR/support in staffing agencies
          if (bonuses.placementFeeMultiplier && (agent.office === 'hr' || agent.office === 'support')) {
            payMult *= bonuses.placementFeeMultiplier;
          }
          projectRevenue += (avgPay * qualityMult / avgTime) * weight * payMult;
        } else {
          infraCosts += (hybrid.costPay / avgTime) * weight;
        }
        continue;
      }

      const avgPay = AVG_PROJECT_PAY[agent.office] || 800;

      // Revenue per day = (avg pay * quality) / avg time * weight
      const qualityMult = 0.5 + agent.efficiency * 0.7; // 0.5-1.2x
      const dailyProjectRevenue = (avgPay * qualityMult / avgTime) * weight;

      // Apply company bonuses
      let payMult = bonuses.projectPayMultiplier || 1.0;
      if (bonuses.reputationPayMultiplier && reputation > 50) {
        payMult *= 1 + (reputation - 50) / 100 * (bonuses.reputationPayMultiplier - 1);
      }

      projectRevenue += dailyProjectRevenue * payMult;
    }

    // Bulk order bonus: X% chance any project pays 3x (applied as expected value)
    const bulkChance = bonuses.bulkOrderChance || 0;
    if (bulkChance > 0) {
      // EV boost: bulkChance * (3x - 1x) = bulkChance * 2
      projectRevenue *= 1 + bulkChance * 2;
    }

    // Infrastructure passive bonuses (compensate for costs)
    const hasLegal = agents.some(a => a.office === 'legal');
    const hasIT = agents.some(a => a.office === 'it');
    const hasFinance = agents.some(a => a.office === 'finance');
    if (hasLegal) projectRevenue *= 1.15;   // +15% pay on all projects
    if (hasIT) projectRevenue *= 1.08;      // +8% global efficiency
    money += Math.round(infraCosts);        // apply cost center expenses

    // ── Revenue: Walk-in customers (fashion_retail special) ──
    let walkinRevenue = 0;
    if (bonuses.walkinMultiplier && rooms.includes('shopfront')) {
      const walkinMult = bonuses.walkinMultiplier || 1.0;
      const shopAssistants = agents.filter(a => a.office === 'shopfront').length;
      // Walk-in threshold is 15 for shopfront (vs 30 normally)
      // Average 2-4 customers per day with high reputation, each spending $80-200
      const customersPerDay = Math.max(0, (reputation - 15) / 85) * walkinMult * Math.min(shopAssistants, 3) * 0.8;
      const avgSpend = 140; // midpoint of $80-300
      const conversionRate = 0.65; // ~65% of served customers buy
      walkinRevenue = customersPerDay * avgSpend * conversionRate;
    }

    // ── Revenue: Organic funnel (simplified) ──
    const organicMult = bonuses.organicMultiplier || 1.0;
    const founderDemandMult = bonuses.founderDemandMultiplier || 1.0;
    const hasSupport = agents.some(a => a.office === 'support');
    const hasSales = agents.some(a => a.office === 'sales');

    // Simplified funnel: reputation → visitors → leads → clients → projects
    const founderDemand = (8 + reputation * 0.2) * founderDemandMult;
    const organicVisitors = reputation * ECONOMY.reputation_organic_factor * organicMult;
    const totalVisitors = organicVisitors + founderDemand;
    const websiteCR = ECONOMY.base_website_cr;
    const leads = totalVisitors * websiteCR;
    const closeRate = ECONOMY.base_close_rate * (hasSales ? 1.5 : 0.7);
    const clients = leads * closeRate;
    // Each client → ~1 project that pays avg delivery rate
    const avgDeliveryPay = deliveryOffices.length > 0
      ? deliveryOffices.reduce((s, o) => s + (AVG_PROJECT_PAY[o] || 800), 0) / deliveryOffices.length
      : 800;
    // But this is already counted in project revenue above, so just add the flow rate effect
    const flowRate = hasSales ? 1.0 : ECONOMY.no_sales_flow_rate;

    // ── Revenue: MRR for exponential models ──
    let mrrRevenue = 0;
    if (gm.model === 'exponential') {
      // Product level grows with engineering output
      const engAgents = agents.filter(a => a.office === 'engineering' || a.office === 'data');
      productLevel += engAgents.length * 0.5;
      const retention = hasSupport ? 0.85 : 0.60;
      const mrrPerLevel = companyType === 'saas_startup' ? 15 : 10;
      mrrRevenue = productLevel * mrrPerLevel * retention;
    }

    // ── Total revenue ──
    const dailyRevenue = Math.round(projectRevenue + walkinRevenue + mrrRevenue);
    money += dailyRevenue;
    totalRevenue += dailyRevenue;

    // ── Reputation changes ──
    if (hasSupport) reputation = Math.min(100, reputation + ECONOMY.support_rep_gain);
    else reputation = Math.max(0, reputation - ECONOMY.support_rep_decay * 0.5);
    if (bonuses.reputationGainMultiplier) {
      reputation = Math.min(100, reputation + 0.05 * (bonuses.reputationGainMultiplier - 1));
    }

    // ── Valuation ──
    let valuation = 0;
    const dailyProfit = dailyRevenue - dailyCost;
    const annualProfit = Math.max(0, dailyProfit * 365);
    if (gm.model === 'exponential') {
      valuation = mrrRevenue * 365 * 12;
    } else if (gm.model === 'premium') {
      valuation = annualProfit * 5;
    } else if (gm.model === 'physical') {
      valuation = annualProfit * 3.5;
    } else {
      valuation = annualProfit * 4;
    }

    dailyLog.push({
      day,
      agents: agents.length,
      rooms: rooms.length,
      revenue: dailyRevenue,
      costs: dailyCost,
      profit: dailyRevenue - dailyCost,
      money: Math.round(money),
      totalRevenue: Math.round(totalRevenue),
      reputation: Math.round(reputation),
      walkinRevenue: Math.round(walkinRevenue),
      mrrRevenue: Math.round(mrrRevenue),
      valuation: Math.round(valuation),
    });
  }

  return { companyType, name: def.name, icon: def.icon, growth: gm.label, dailyLog };
}

// ─── Run & Report ───────────────────────────────────────────

const SIM_DAYS = 150;

console.log('═══════════════════════════════════════════════════════════');
console.log(`  BUSINESS TYCOON — Economy Balance Simulator (${SIM_DAYS} days)`);
console.log('═══════════════════════════════════════════════════════════\n');

const results = [];

for (const companyType of Object.keys(COMPANY_TYPES)) {
  const result = simulate(companyType);
  results.push(result);
}

// Summary table
console.log('┌──────────────────────┬────────┬──────────┬──────────┬──────────┬──────────┬────────────┬───────┬──────────────┐');
console.log('│ Company              │ Growth │  Day 30  │  Day 60  │  Day 90  │ Day 150  │ Total Rev  │ Rep   │  Valuation   │');
console.log('│                      │ Model  │  Profit  │  Profit  │  Profit  │  Profit  │  (150 day) │ D150  │   Day 150    │');
console.log('├──────────────────────┼────────┼──────────┼──────────┼──────────┼──────────┼────────────┼───────┼──────────────┤');

for (const r of results) {
  const d30 = r.dailyLog[29];
  const d60 = r.dailyLog[59];
  const d90 = r.dailyLog[89];
  const d150 = r.dailyLog[149];

  const name = `${r.icon} ${r.name}`.padEnd(20);
  const growth = r.growth.padEnd(6);
  const p30 = String(d30.profit).padStart(8);
  const p60 = String(d60.profit).padStart(8);
  const p90 = String(d90.profit).padStart(8);
  const p150 = String(d150.profit).padStart(8);
  const rev = ('$' + d150.totalRevenue.toLocaleString()).padStart(10);
  const rep = String(d150.reputation).padStart(5);
  const val = ('$' + d150.valuation.toLocaleString()).padStart(12);

  console.log(`│ ${name} │ ${growth} │ ${p30} │ ${p60} │ ${p90} │ ${p150} │ ${rev} │ ${rep} │ ${val} │`);
}

console.log('└──────────────────────┴────────┴──────────┴──────────┴──────────┴──────────┴────────────┴───────┴──────────────┘');

// Cash flow chart for each
console.log(`\n── Cash Balance Over ${SIM_DAYS} Days ──\n`);

for (const r of results) {
  const dEnd = r.dailyLog[SIM_DAYS - 1];
  const minMoney = Math.min(...r.dailyLog.map(d => d.money));
  const maxMoney = Math.max(...r.dailyLog.map(d => d.money));
  const bankrupt = r.dailyLog.find(d => d.money < -5000);

  const cashStart = r.dailyLog[0].money;
  const cashEnd = dEnd.money;
  const trend = cashEnd > cashStart ? '📈' : cashEnd < 0 ? '💀' : '📉';

  console.log(`${r.icon} ${r.name} ${trend}  Cash: $${cashStart.toLocaleString()} → $${cashEnd.toLocaleString()}  (min: $${minMoney.toLocaleString()}, max: $${maxMoney.toLocaleString()})${bankrupt ? ` ⚠️  BANKRUPTCY DAY ${bankrupt.day}` : ''}`);
}

// Detailed per-day for fashion_retail
console.log('\n── Fashion Store Daily Breakdown ──\n');
const fashion = results.find(r => r.companyType === 'fashion_retail');
if (fashion) {
  console.log('Day │ Agents │ Revenue │ Walk-in │  Costs │  Profit │      Cash │ Rep');
  console.log('────┼────────┼─────────┼─────────┼────────┼─────────┼───────────┼────');
  for (const d of fashion.dailyLog) {
    if (d.day <= 5 || d.day % 10 === 0 || d.day === SIM_DAYS) {
      console.log(
        `${String(d.day).padStart(3)} │ ${String(d.agents).padStart(6)} │ ${('$'+d.revenue).padStart(7)} │ ${('$'+d.walkinRevenue).padStart(7)} │ ${('$'+d.costs).padStart(6)} │ ${((d.profit >= 0 ? '+' : '') + '$' + d.profit).padStart(7)} │ ${('$'+d.money.toLocaleString()).padStart(9)} │ ${d.reputation}`
      );
    }
  }
}

// Balance warnings
console.log('\n── Balance Warnings ──\n');
for (const r of results) {
  const dEnd = r.dailyLog[SIM_DAYS - 1];
  const issues = [];

  if (dEnd.money < 0) issues.push(`💀 Negative cash by day ${SIM_DAYS}`);
  if (dEnd.profit < -100) issues.push(`📉 Unprofitable day ${SIM_DAYS} ($${dEnd.profit}/day)`);
  if (dEnd.totalRevenue < 20000) issues.push(`🐌 Very low total revenue ($${dEnd.totalRevenue.toLocaleString()})`);
  if (dEnd.reputation < 30) issues.push(`😡 Low reputation (${dEnd.reputation})`);

  const bankrupt = r.dailyLog.find(d => d.money < -5000);
  if (bankrupt) issues.push(`⚠️  Hits bankruptcy threshold on day ${bankrupt.day}`);

  // Breakeven day
  const breakeven = r.dailyLog.find(d => d.day > 10 && d.profit > 0);
  if (breakeven) issues.push(`✅ Breakeven on day ${breakeven.day}`);
  else issues.push(`❌ Never reaches breakeven`);

  // Compare to median
  const allRevenues = results.map(x => x.dailyLog[SIM_DAYS - 1].totalRevenue);
  const medianRev = [...allRevenues].sort((a,b) => a-b)[Math.floor(allRevenues.length/2)];
  if (dEnd.totalRevenue < medianRev * 0.5) issues.push(`⚖️  Revenue < 50% of median ($${medianRev.toLocaleString()})`);
  if (dEnd.totalRevenue > medianRev * 2.0) issues.push(`⚖️  Revenue > 200% of median — may be OP`);

  if (issues.length > 0) {
    console.log(`${r.icon} ${r.name}:`);
    for (const issue of issues) console.log(`   ${issue}`);
  }
}

console.log('\n✅ Simulation complete.');
