# Frontend Design System — Recognition IQ

CodeRabbit-inspired premium dark theme. Warm, intentional, mature.

## Color Tokens

### Backgrounds
```
--bg-root:     #09090b     /* Near-black, app root */
--bg-base:     #0c0c0f     /* Content area */
--bg-raised:   #131318     /* Elevated surfaces */
--bg-surface:  rgba(19,19,24,0.72)  /* Glass panels (with backdrop-blur:20px) */
--bg-subtle:   rgba(255,255,255,0.02) /* Row hover, table stripe */
```

### Borders
```
--border-hairline: rgba(255,255,255,0.06)  /* Sidebar, footer dividers */
--border-subtle:   rgba(255,255,255,0.09)  /* Default card borders */
--border-medium:   rgba(255,255,255,0.14)  /* Hover state, tooltips */
--border-focus:    rgba(255,138,76,0.5)    /* Focus ring on inputs */
```

### Text
```
--text-primary:    #fafafa  /* Headings, values */
--text-secondary:  #a1a1aa  /* Body text, descriptions */
--text-tertiary:   #71717a  /* Labels, muted content */
--text-muted:      #52525b  /* Placeholders, disabled */
--text-inverse:    #09090b  /* Text on bright backgrounds */
```

### Accent Colors (max 8, use sparingly)
```
--accent-orange:       #FF8A4C   /* PRIMARY — brand accent, CTAs, active nav */
--accent-orange-light: #FFB088   /* Hover variant */
--accent-orange-muted: rgba(255,138,76,0.12)  /* Badge bg, icon bg */
--accent-emerald:      #34d399   /* Success, positive change, "improving" */
--accent-emerald-muted: rgba(52,211,153,0.10)
--accent-purple:       #a78bfa   /* Secondary accent, Gini, diversity */
--accent-purple-muted: rgba(167,139,250,0.10)
--accent-amber:        #fbbf24   /* Warnings, "stable", monetary values */
--accent-amber-muted:  rgba(251,191,36,0.10)
--accent-rose:         #fb7185   /* Critical, errors, "declining", attrition */
--accent-rose-muted:   rgba(251,113,133,0.10)
--accent-blue:         #60a5fa   /* Info badges, links */
--accent-cyan:         #22d3ee   /* Tertiary charts */
--accent-pink:         #f472b6   /* Tertiary charts */
```

### Chart Palette (in order)
```
["#FF8A4C", "#34d399", "#a78bfa", "#60a5fa", "#fbbf24", "#fb7185", "#22d3ee", "#f472b6"]
```

## Typography
- **Font:** Inter (weights: 400, 500, 600, 700, 800, 900)
- **Page titles:** 24px, weight 800, letter-spacing -0.03em
- **Section titles:** 14px, weight 700, letter-spacing -0.01em
- **KPI values:** 28px, weight 800, letter-spacing -0.03em, line-height 1.1
- **Body:** 12-13px, weight 400-500, line-height 1.6
- **Labels:** 11px, weight 600, letter-spacing 0.06em, uppercase
- **Nav group labels:** 9.5px, weight 700, letter-spacing 0.1em, uppercase
- **Badge text:** 10px, weight 700
- **NEVER use all-caps on body text or headings — only on labels/badges**

## Spacing Scale
4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 48, 64 — multiples of 4px.
- Card padding: 24px
- Gap between cards: 16px
- Gap between sections: 20px
- Page padding: 28px horizontal, 44px bottom
- Max content width: 1320px, centered

## Border Radius
```
xs: 6px    /* Small buttons, inputs */
sm: 8px    /* Nav items, badges, icons */
md: 12px   /* Rows, list items, tooltips */
lg: 16px   /* Cards, panels */
xl: 20px   /* Main panels, modals */
xxl: 24px  /* Hero sections */
pill: 9999px /* Badges, pill buttons, selects */
```

## Shadows
```
sm: 0 1px 3px rgba(0,0,0,0.3)          /* Default panel */
md: 0 4px 20px rgba(0,0,0,0.35)        /* Hover state */
lg: 0 12px 40px rgba(0,0,0,0.45)       /* Tooltips, overlays */
glow(color): 0 0 Npx {color}25, 0 0 2Npx {color}10  /* Brand buttons */
```

## Component Patterns

### Glass Panel (foundation card)
- background: var(--bg-surface) with backdrop-filter: blur(20px)
- border: 1px solid var(--border-subtle)
- border-radius: 20px (var(--radius-xl))
- padding: 24px
- animation: fadeUp 0.45s ease-out both (with stagger delay)
- NEVER use solid backgrounds on cards

### KPI Card
- Panel with icon top-right (38x38 rounded-md, background: accent+10)
- Label: uppercase, 11px, tertiary color
- Value: 28px bold with AnimatedNumber component
- Change indicator: ArrowUpRight/Down + percentage + context label
- Loading state: 2 skeleton bars (shimmer animation)

### Badge
- Pill shape (border-radius: 9999)
- Background: color at 14% opacity (e.g., `${color}14`)
- Border: color at 18% opacity
- Font: 10px, weight 700
- Optional leading dot (4px circle)

### Section Header
- Left: Icon (30x30 rounded-sm, orange muted bg) + title + optional subtitle
- Right: Optional action (badge or button)
- Margin bottom: 20px

### Page Hero
- Icon (40x40 rounded-lg, gradient orange bg) + title (24px, 800w)
- Subtitle below (13px, tertiary, max-width 560)
- Orange gradient underline (48px wide, 2px, fades to transparent)
- Margin bottom: 28px

### AI Insight Banner
- Full-width, rounded-lg
- Background: linear-gradient(135deg, color 8%, color 3%)
- Border: color at 15% opacity
- Left: icon circle (36x36), right: optional CTA pill button
- Use for proactive AI-generated suggestions

### Buttons
- **Primary:** pill, gradient (orange to #e85d04), white text, glow shadow
- **Secondary:** pill, transparent bg, border-subtle, tertiary text
- **Ghost-Write:** pill, orange-muted bg, orange border 25%, orange text

### Tables / Data Rows
- CSS Grid (NOT HTML table)
- Each row: padding 10-11px 14px, border-radius 12px
- Background: rgba(255,255,255,0.02), border: hairline
- First-place rows: orange 6% bg, orange 10% border
- Critical rows: rose-muted border

### Charts (Recharts)
- CartesianGrid: strokeDasharray="3 3", stroke="rgba(255,255,255,0.03)"
- Axis ticks: fill=text-muted, fontSize=10, axisLine=false, tickLine=false
- Area gradients: color at 20% opacity → 0% opacity
- Bar radius: [0,4,4,0] for horizontal, [4,4,0,0] for vertical
- Custom tooltip: glass panel style (bg-surface 95%, blur-16px, border-medium, rounded-md)
- NEVER use default Recharts tooltip styling

### Sidebar
- Width: 228px expanded, 60px collapsed
- Background: rgba(9,9,11,0.96) with blur-24px
- Active indicator: 2px vertical bar (or 14px horizontal when collapsed) with glow shadow
- Nav groups: muted uppercase labels (9.5px)
- Icons: 16px, muted color default, group color when active
- Transition: width 0.38s cubic-bezier(0.16, 1, 0.3, 1)

### Ambient Background
Fixed fullscreen div behind content:
- radial-gradient(ellipse 70% 50% at 30% -5%, rgba(255,138,76,0.04), transparent 55%)
- radial-gradient(ellipse 50% 40% at 85% 100%, rgba(167,139,250,0.03), transparent 50%)

## Animations
```css
@keyframes shimmer    /* Skeleton loader: bg-position slide, 2s infinite */
@keyframes fadeUp     /* Panel entrance: opacity 0→1, translateY 6px→0, 0.45s */
@keyframes spin       /* Loader: rotate 360deg, 1s linear infinite */
@keyframes glowPulse  /* Critical dots: opacity 0.5→1→0.5, 2s infinite */
```
- Stagger KPI cards by 60ms delay each (delay={0}, delay={60}, delay={120}, delay={180})
- NEVER use bouncy or playful animations. Everything calm, professional.
- Hover: translateY(-2px) + shadow upgrade. Transition: 220ms cubic-bezier(.4,0,.2,1)

## Nav Group Colors
| Group | Accent |
|---|---|
| Analytics | orange (#FF8A4C) |
| AI & ML | purple (#a78bfa) |
| People | emerald (#34d399) |
| Impact | amber (#fbbf24) |
| Ops | rose (#fb7185) |
