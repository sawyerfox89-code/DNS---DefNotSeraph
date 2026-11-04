// ═══════════════════════════════════════════════════════════════
//  BUSINESS TYCOON — Level Intro Overlay
// ═══════════════════════════════════════════════════════════════

import { G } from '../game.js';
import { getRoomInstances } from '../map.js';

let introEl = null;
let hideTimer = null;

export function initIntro() {
  introEl = document.getElementById('level-intro');
}

// ─── Company level: earned through actual progress ───────
// Revenue is the primary driver, but team size and offices give bonus XP.
// This means a broke company stays at low levels even after many weeks,
// while a fast-growing one rockets through stages.

const LEVEL_THRESHOLDS = [
  //  lvl   revenue   team  offices
  {   lvl: 1,   rev: 0,        team: 0, rooms: 0 },
  {   lvl: 2,   rev: 500,      team: 1, rooms: 1 },
  {   lvl: 3,   rev: 2000,     team: 1, rooms: 2 },
  {   lvl: 4,   rev: 5000,     team: 2, rooms: 3 },
  {   lvl: 5,   rev: 10000,    team: 3, rooms: 4 },
  {   lvl: 6,   rev: 20000,    team: 4, rooms: 5 },
  {   lvl: 7,   rev: 35000,    team: 5, rooms: 6 },
  {   lvl: 8,   rev: 55000,    team: 6, rooms: 7 },
  {   lvl: 9,   rev: 80000,    team: 7, rooms: 8 },
  {   lvl: 10,  rev: 120000,   team: 8, rooms: 9 },
  {   lvl: 11,  rev: 170000,   team: 9, rooms: 10 },
  {   lvl: 12,  rev: 250000,   team: 10, rooms: 11 },
  {   lvl: 13,  rev: 350000,   team: 11, rooms: 12 },
  {   lvl: 14,  rev: 500000,   team: 12, rooms: 13 },
  {   lvl: 15,  rev: 700000,   team: 13, rooms: 14 },
  {   lvl: 16,  rev: 1000000,  team: 14, rooms: 15 },
];

// Stages: title + eyebrow keyed to computed level
const LEVEL_STAGES = [
  { max: 1,  title: 'The Garage',        eyebrow: 'Humble Beginnings' },
  { max: 2,  title: 'First Steps',       eyebrow: 'Proving Ground' },
  { max: 3,  title: 'Scrappy Startup',   eyebrow: 'Bootstrapping' },
  { max: 4,  title: 'Growing Pains',     eyebrow: 'Scaling Up' },
  { max: 5,  title: 'Real Business',     eyebrow: 'Getting Serious' },
  { max: 6,  title: 'Market Traction',   eyebrow: 'Momentum' },
  { max: 8,  title: 'Revenue Engine',    eyebrow: 'Firing On All Cylinders' },
  { max: 10, title: 'Industry Player',   eyebrow: 'Making Waves' },
  { max: 12, title: 'Growth Machine',    eyebrow: 'Hypergrowth' },
  { max: 14, title: 'Market Leader',     eyebrow: 'Domination' },
  { max: 99, title: 'Empire',            eyebrow: 'Legendary' },
];

export function getCompanyLevel() {
  const rev = G.totalRevenue;
  const team = G.agents.length;
  const rooms = getRoomInstances().length;

  let level = 1;
  for (const t of LEVEL_THRESHOLDS) {
    // Must meet revenue AND at least one of team/rooms
    if (rev >= t.rev && (team >= t.team || rooms >= t.rooms)) {
      level = t.lvl;
    } else {
      break;
    }
  }
  return level;
}

function getStage(level) {
  return LEVEL_STAGES.find(s => level <= s.max) || LEVEL_STAGES[LEVEL_STAGES.length - 1];
}

// Subtitle pools — themed by progress tier
const SUBTITLES_EARLY = [
  'Every empire starts somewhere.',
  'Your first hire is waiting.',
  'Build something great.',
  'Keep the lights on.',
  'Ramen profitable? Not yet.',
  'The journey of a thousand deals...',
];

const SUBTITLES_GROWTH = [
  'Bigger deals, bigger stakes.',
  'Time to hire smarter.',
  'The competition is watching.',
  'Revenue is oxygen. Keep breathing.',
  'Scale or stall — your call.',
  'Your reputation precedes you.',
  'The phones won\'t stop ringing.',
];

const SUBTITLES_LATE = [
  'They write about companies like yours.',
  'From startup to powerhouse.',
  'Talent is lining up at your door.',
  'The board is impressed.',
  'Acquisition offers incoming...',
  'You\'re building a legacy.',
  'The market bends to your will.',
  'IPO or keep printing cash?',
];

function pickSubtitle(level) {
  const pool = level <= 4 ? SUBTITLES_EARLY : level <= 10 ? SUBTITLES_GROWTH : SUBTITLES_LATE;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Track last shown level so we only show the intro on actual level-ups
let lastShownLevel = 0;

export function showLevelIntro({ week, day, subtitle } = {}) {
  if (!introEl) return;

  const level = getCompanyLevel();

  // Don't show if company hasn't actually leveled up since last intro
  if (level <= lastShownLevel && !subtitle) return;
  lastShownLevel = level;

  const stage = getStage(level);
  const dayText = day ? `Week ${week} · Day ${day}` : '';
  const sub = subtitle || pickSubtitle(level);

  introEl.innerHTML = `
    <div class="intro-eyebrow">${stage.eyebrow}</div>
    <div class="intro-title">${stage.title}</div>
    <div class="intro-level">Level ${level}</div>
    <div class="intro-subtitle">${sub}</div>
    <div class="intro-meta">${dayText}</div>
    <div class="intro-skip">Click to skip</div>
  `;

  introEl.classList.add('visible');

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(hideIntro, 2400);
}

export function hideIntro() {
  if (!introEl) return;
  introEl.classList.remove('visible');
}
