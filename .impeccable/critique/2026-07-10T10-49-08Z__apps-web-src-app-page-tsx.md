---
target: landing page
total_score: 27
p0_count: 0
p1_count: 2
p2_count: 2
p3_count: 1
timestamp: 2026-07-10T10-49-08Z
slug: apps-web-src-app-page-tsx
---
# Relunar Landing Page Critique

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Copy button works; nav has no scroll-spy; hero ping runs forever |
| 2 | Match System / Real World | 3 | Strong maintainer copy; assumes Daytona/harness literacy |
| 3 | User Control and Freedom | 3 | FAQ accordion, theme toggle, skip link adequate |
| 4 | Consistency and Standards | 3 | Cohesive tokens; repetitive section template |
| 5 | Error Prevention | 3 | N/A for static page; install copyable |
| 6 | Recognition Rather Than Recall | 3 | Docs/FAQ help; no sticky install after hero |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts; long scroll; uniform reveals |
| 8 | Aesthetic and Minimalist Design | 2 | Grain + glows + 10+ bordered cards exceed information load |
| 9 | Error Recovery | 3 | N/A |
| 10 | Help and Documentation | 4 | FAQ + /docs links throughout |
| **Total** | | **27/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment:** Yes — recognizable AI/editorial-dev-tool template. Instrument Serif + Geist + cream `#f7f6f2`, eyebrows on every section, ghost-cards (border + 44px shadow), uniform Reveal animations (0.65s), numbered step cards, glass panels.

**Deterministic scan:** 0 findings across 35 source files. Detector misses CSS-variable fonts and computed contrast issues.

## Overall Impression

Copy and documentation paths are production-ready. Visual system is competent but sits in the saturated editorial-dev-tool lane. Highest leverage: break the template and show a real report artifact.

## What's Working

1. Copy discipline — specific value props, direct FAQ answers
2. Code as hero artifact — install panel and .relunar.yml preview
3. Reduced-motion awareness in Reveal, Hero, FAQ

## Priority Issues

### [P1] Editorial-template sameness
Page reads "AI landing," not "CLI harness." Fix: break aesthetic lane, drop eyebrows from 5/6 sections. Command: `$impeccable bolder` + `$impeccable typeset`

### [P1] Ghost-card monoculture
border + 44px shadow on every surface. Fix: flat borders on code panels only, shadow on one primary demo. Command: `$impeccable quieter` + `$impeccable layout`

### [P2] No product proof
Never shows report.md, report.json, or terminal output. Fix: replace one card grid with artifact preview. Command: `$impeccable shape` + `$impeccable delight`

### [P2] Uniform scroll-reveal animation
Reveal 0.65s on every block — 15+ entrances per scroll. Fix: animate hero + CTA only, cap at 250ms. Command: `$impeccable animate`

### [P3] Contrast risk on subtle text
`#8b8b95` on `#f7f6f2` = 3.12:1 — fails WCAG AA. Command: `$impeccable audit`

## Persona Red Flags

**Jordan:** "Daytona" and "harness" undefined in hero; eyebrow labels add translation layer.

**Riley:** No failed repro state shown; "Deterministic" claim without output sample.

**Casey:** Mobile header hides "Get started" behind hamburger; no sticky install CTA.

**Morgan (maintainer):** No report.md preview; purple glow signals SaaS not local-first CLI.

## Minor Observations

- SectionDivider between every section adds rhythm without IA benefit
- animate-ping ignores prefers-reduced-motion
- Theme toggle and copy button lack :active press state
- Mobile menu may trap focus when collapsed
- Touch targets 36px on icon buttons

## Questions to Consider

- What if the hero showed a real report.json instead of a third marketing card grid?
- Does this page need six sections with identical eyebrows, or three with proof?
- What would a terminal-native, local-first version look like?
