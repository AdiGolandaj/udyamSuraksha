# DESIGN_SYSTEM.md
# DisasterShield — Design System & Component Standards

---

## 1. Design Philosophy

1. **Reuse first, build second** — Before writing any new UI, check the reusable component inventory in Section 8. If a pattern exists, use it. If a variation is needed, extend the existing component via props — never duplicate it.
2. **Mobile-first for MSME, Desktop-first for LRDB** — All MSME components are designed at 375px and scaled up. All LRDB components are designed at 1280px and scaled down.
3. **Actionable over decorative** — Every page surfaces a primary action. No page is purely informational.
4. **Accessible by default** — WCAG AA contrast minimum. All interactive elements are keyboard navigable. All icons have `aria-label` or accompanying visible text.
5. **Consistent density** — MSME pages use comfortable spacing (more breathing room, larger tap targets). LRDB pages use compact spacing (more data per screen).

---

## 2. Color System

All colors are defined as Tailwind CSS custom tokens in `tailwind.config.ts`. Use these tokens everywhere — never hardcode hex values in components.

### Primary Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `brand-primary` | `#1A6B4A` | Primary buttons, key highlights, active nav items |
| `brand-primary-light` | `#E8F5EF` | Backgrounds for primary-tinted surfaces |
| `brand-primary-dark` | `#0F4530` | Hover state for primary buttons |
| `brand-secondary` | `#2563EB` | Links, info states, secondary actions |
| `brand-secondary-light` | `#EFF6FF` | Info surface backgrounds |

### Semantic / Status Colors

| Token | Hex | Usage |
|---|---|---|
| `status-safe` | `#16A34A` | Safe risk level, success states |
| `status-safe-bg` | `#F0FDF4` | Safe status background |
| `status-moderate` | `#D97706` | Moderate risk level, warning states |
| `status-moderate-bg` | `#FFFBEB` | Moderate status background |
| `status-high` | `#EA580C` | High risk level |
| `status-high-bg` | `#FFF7ED` | High risk background |
| `status-critical` | `#DC2626` | Critical risk level, errors, SOS |
| `status-critical-bg` | `#FEF2F2` | Critical status background |
| `status-offline` | `#6B7280` | Offline/unreachable state |
| `status-offline-bg` | `#F9FAFB` | Offline status background |

### Neutral / Surface Colors

| Token | Hex | Usage |
|---|---|---|
| `surface-primary` | `#FFFFFF` | Card backgrounds, modals |
| `surface-secondary` | `#F8FAFC` | Page backgrounds |
| `surface-tertiary` | `#F1F5F9` | Input backgrounds, table alternates |
| `border-default` | `#E2E8F0` | Default borders |
| `border-strong` | `#CBD5E1` | Emphasized borders, dividers |

### Text Colors

| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#0F172A` | Body text, headings |
| `text-secondary` | `#475569` | Subtext, labels, captions |
| `text-tertiary` | `#94A3B8` | Placeholder text, hints |
| `text-inverse` | `#FFFFFF` | Text on dark/colored backgrounds |

### Disaster Sensitivity Tag Colors (Stock Module)

| Sensitivity | Background Token | Text Token |
|---|---|---|
| Water-sensitive | `#EFF6FF` | `#1D4ED8` |
| Heat-sensitive | `#FFF7ED` | `#C2410C` |
| Fragile | `#FDF4FF` | `#7E22CE` |
| Perishable | `#F0FDF4` | `#15803D` |
| Flammable | `#FEF2F2` | `#B91C1C` |
| Theft-prone | `#FEFCE8` | `#A16207` |
| Humidity-sensitive | `#F0F9FF` | `#0369A1` |

---

## 3. Typography

Font stack is defined once in `tailwind.config.ts` and applied globally via `app/root.tsx`.

### Font Family

```
font-sans: 'Inter', system-ui, -apple-system, sans-serif
font-marathi: 'Noto Sans Devanagari', sans-serif  /* for Marathi & Hindi rendering */
```

Both fonts are loaded via Google Fonts in `app/root.tsx`. When the user's language is set to Marathi or Hindi, the `font-marathi` class is applied to the root `<html>` element via the i18n context.

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `text-display` | 30px | 700 | 1.2 | Page hero titles (landing only) |
| `text-h1` | 24px | 600 | 1.3 | Page-level headings |
| `text-h2` | 20px | 600 | 1.35 | Section headings |
| `text-h3` | 16px | 600 | 1.4 | Card headings, sub-section titles |
| `text-body-lg` | 16px | 400 | 1.6 | Primary body text |
| `text-body` | 14px | 400 | 1.6 | Default body text |
| `text-body-sm` | 13px | 400 | 1.5 | Secondary body, table cells |
| `text-caption` | 12px | 400 | 1.4 | Labels, timestamps, hints |
| `text-label` | 12px | 500 | 1.2 | Form labels, badge text |

### Typography Rules
- Never go below 12px for any visible text.
- Headings use `font-semibold` (600). Labels and badges use `font-medium` (500). Body uses `font-normal` (400).
- Line lengths should not exceed 72 characters for body copy.
- Use `truncate` Tailwind class for single-line overflow in table cells and card titles.

---

## 4. Spacing System

DisasterShield uses Tailwind's default 4px base spacing scale. The following are the approved spacing values for layout-level decisions:

| Usage | Token | Value |
|---|---|---|
| Page horizontal padding (mobile) | `px-4` | 16px |
| Page horizontal padding (desktop) | `px-6` or `px-8` | 24px / 32px |
| Section vertical gap | `gap-6` | 24px |
| Card internal padding | `p-4` or `p-5` | 16px / 20px |
| Card grid gap | `gap-4` | 16px |
| Form field gap | `gap-3` | 12px |
| Inline element gap | `gap-2` | 8px |
| Icon-to-text gap | `gap-1.5` | 6px |

---

## 5. Border Radius

| Usage | Token | Value |
|---|---|---|
| Cards | `rounded-xl` | 12px |
| Buttons | `rounded-lg` | 8px |
| Badges / Tags | `rounded-full` | 9999px |
| Inputs | `rounded-lg` | 8px |
| Modals / Dialogs | `rounded-2xl` | 16px |
| Avatar circles | `rounded-full` | 9999px |

---

## 6. Elevation & Shadows

DisasterShield uses minimal shadow. Only two levels are permitted:

| Level | Tailwind Class | Usage |
|---|---|---|
| Card | `shadow-sm` | All standard cards |
| Modal / Dropdown | `shadow-lg` | Dialogs, popovers, dropdowns |
| Active / Focus | `ring-2 ring-brand-primary ring-offset-2` | Focused inputs and buttons |

No `shadow-xl`, `shadow-2xl`, or drop-shadow effects anywhere.

---

## 7. Iconography

**Library:** Lucide React (bundled with shadcn/ui). No other icon library is to be used.

### Icon Size Standards

| Context | Size | Tailwind |
|---|---|---|
| Inline with body text | 16px | `size-4` |
| Button icons | 18px | `size-[18px]` |
| Nav / Sidebar icons | 20px | `size-5` |
| Feature / Section icons | 24px | `size-6` |
| Empty state illustrations | 48px | `size-12` |

### Icon Usage Rules
- Icons must always be accompanied by a visible label OR an `aria-label` on the parent button.
- Use `aria-hidden="true"` on decorative icons.
- Risk level icons follow semantic color tokens strictly (safe = green, moderate = amber, high = orange, critical = red).

### Icon-to-Concept Map (use consistently across all pages)

| Concept | Lucide Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Stock / Inventory | `Package` |
| BCP | `ClipboardList` |
| Alerts | `BellRing` |
| Chat | `MessageSquare` |
| Risk | `ShieldAlert` |
| Trends | `TrendingUp` |
| Forecasts / Estimates | `Calculator` |
| Settings | `Settings` |
| Shops list | `Store` |
| Queries | `Inbox` |
| Reports | `FileBarChart` |
| Estimation (LRDB) | `Banknote` |
| SOS / Emergency | `Siren` |
| Safe status | `ShieldCheck` |
| Warning | `AlertTriangle` |
| Critical | `AlertOctagon` |
| Flood | `Droplets` |
| Wind | `Wind` |
| Power outage | `ZapOff` |
| Location | `MapPin` |
| User / Owner | `UserCircle` |
| Government / LRDB | `Landmark` |
| Phone call | `Phone` |
| Video call | `Video` |
| Group | `Users` |

---

## 8. shadcn/ui Component Usage Map

All components are imported from `@/components/ui/`. Do not re-implement any component that shadcn/ui already provides.

| shadcn Component | Used In |
|---|---|
| `Button` | All pages — primary, secondary, destructive, ghost, icon variants |
| `Card`, `CardHeader`, `CardContent`, `CardFooter` | Dashboard tiles, stock cards, shop cards, query cards |
| `Badge` | Risk levels, alert severity, query status, sensitivity tags |
| `Dialog`, `DialogContent`, `DialogHeader` | Confirmation modals, detail views, alert detail |
| `Sheet` | Mobile side navigation drawer, filter panels |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | BCP (before/during/after), LRDB reports, chat labels |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` | Stock list, shop list, queries list, alert history |
| `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` | Register, stock add/edit, settings, alert creation |
| `Input` | All text inputs |
| `Textarea` | BCP notes, query description, alert message body |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | Category filters, language selector, priority selector |
| `Switch` | Notification toggles in settings |
| `Checkbox` | BCP checklists, multi-select filters |
| `Avatar`, `AvatarImage`, `AvatarFallback` | Chat bubbles, shop owner display, officer display |
| `Separator` | Section dividers within cards |
| `Tooltip`, `TooltipContent`, `TooltipTrigger` | Icon-only buttons, truncated text, chart data points |
| `DropdownMenu` | Action menus on table rows, nav profile menu |
| `Alert`, `AlertTitle`, `AlertDescription` | System-level notifications, error states |
| `Progress` | Risk score bar, BCP completion progress, recovery timeline |
| `Skeleton` | Loading states for all cards and tables |
| `ScrollArea` | Chat message thread, long stock lists, sidebar nav |
| `Popover` | Date pickers, filter panels |
| `Command` | Search-and-select for shop lookup, stock search |
| `Breadcrumb` | LRDB detail pages (shop detail, query detail) |
| `Collapsible` | BCP sections, trend accordions |

---

## 9. Reusable Component Inventory

These are custom components that must be built once and reused everywhere. Each lives in `app/components/shared/`. No page should inline these patterns.

### 9.1 Layout Components

#### `<AppShell />`
The root layout wrapper for authenticated pages. Renders the sidebar (desktop) or bottom nav (mobile), the top header bar, and the main content area.

**Props:**
```ts
role: 'msme' | 'lrdb'
userId: string          // UUIDv4
children: ReactNode
```

**Behavior:**
- On desktop (≥1024px): renders a fixed left sidebar with nav links.
- On mobile (<1024px): renders a bottom tab bar (MSME) or a hamburger top nav (LRDB).
- The sidebar/nav items are derived from the `role` prop.

---

#### `<PageHeader />`
Consistent top section of every page inside the app shell.

**Props:**
```ts
title: string
subtitle?: string
action?: ReactNode       // Optional primary CTA button slot
breadcrumb?: BreadcrumbItem[]
```

---

#### `<SectionCard />`
A styled wrapper for logical sections within a page. Wraps shadcn `Card`.

**Props:**
```ts
title?: string
subtitle?: string
icon?: LucideIcon
children: ReactNode
className?: string
noPadding?: boolean
```

---

#### `<EmptyState />`
Shown when a list or data view has no content.

**Props:**
```ts
icon: LucideIcon
title: string
description: string
action?: { label: string; href?: string; onClick?: () => void }
```

---

#### `<LoadingSkeleton />`
Renders a contextual skeleton loader. Wraps shadcn `Skeleton`.

**Props:**
```ts
variant: 'card' | 'table' | 'stat' | 'list' | 'chat'
count?: number           // Number of skeleton rows/cards to show
```

---

### 9.2 Data Display Components

#### `<StatTile />`
A single metric display tile used in dashboards and summary sections.

**Props:**
```ts
label: string
value: string | number
icon: LucideIcon
trend?: { value: number; direction: 'up' | 'down'; label: string }
variant?: 'default' | 'success' | 'warning' | 'danger'
```

**Usage:** Dashboard (MSME & LRDB), Estimation page, Risk Profiling

---

#### `<RiskBadge />`
Displays a risk or status level with consistent color coding.

**Props:**
```ts
level: 'safe' | 'moderate' | 'high' | 'critical' | 'offline'
size?: 'sm' | 'md' | 'lg'
showIcon?: boolean
```

**Usage:** Dashboard, Alerts, Shop list, Risk Profiling, Queries

---

#### `<AlertCard />`
Displays a single disaster alert with severity, title, description, affected stock summary, and action buttons.

**Props:**
```ts
alertId: string
title: string
severity: 'low' | 'medium' | 'high' | 'critical'
category: string          // e.g. 'Flood', 'Wind', 'Power Outage'
issuedAt: string          // ISO timestamp
affectedItems: string[]   // Stock item names
summary: string
actions?: AlertAction[]
isRead?: boolean
language?: 'en' | 'mr' | 'hi'
```

**Usage:** MSME Alerts page, MSME Dashboard, LRDB Alerts page

---

#### `<SensitivityTag />`
Renders a colored badge for a stock item's disaster sensitivity classification.

**Props:**
```ts
type: 'water' | 'heat' | 'fragile' | 'perishable' | 'flammable' | 'theft' | 'humidity'
size?: 'sm' | 'md'
```

**Usage:** Stock Management, Dashboard inventory summary, Risk Profiling

---

#### `<ShopCard />`
Displays an MSME shop entry — used in both the MSME context (own profile) and the LRDB shop list.

**Props:**
```ts
shopId: string
shopName: string
ownerName: string
category: string
location: string
riskLevel: 'safe' | 'moderate' | 'high' | 'critical' | 'offline'
contactNumber?: string
onContact?: () => void    // Opens direct message
href?: string             // Link to detail page
```

**Usage:** LRDB Shop List, LRDB Shop Detail

---

#### `<QueryRow />`
A single row in the queries list, for LRDB use.

**Props:**
```ts
queryId: string
shopName: string
queryType: string
priority: 'low' | 'medium' | 'high' | 'critical'
status: 'pending' | 'under-review' | 'assigned' | 'resolved' | 'escalated'
submittedAt: string
href: string
```

**Usage:** LRDB Queries page

---

#### `<TimelineStep />`
A single step in a before/during/after timeline or BCP checklist.

**Props:**
```ts
stepNumber: number
title: string
description: string
isCompleted?: boolean
isActive?: boolean
onToggle?: () => void
```

**Usage:** BCP page, Alert action steps, Recovery timeline

---

#### `<TrendChip />`
A small indicator showing directional change (up/down) with a percentage.

**Props:**
```ts
value: number
direction: 'up' | 'down'
label?: string
invertColor?: boolean    // When "up" is bad (e.g. loss increase)
```

**Usage:** Dashboard stat tiles, Forecasts page, LRDB Estimation

---

### 9.3 Form Components

#### `<LanguageSelector />`
A dropdown that switches the app language at runtime via i18n context.

**Props:**
```ts
currentLanguage: 'en' | 'mr' | 'hi'
onChange: (lang: 'en' | 'mr' | 'hi') => void
variant?: 'full' | 'compact'    // full = label + flag, compact = flag only
```

**Usage:** Register page, Settings, top header bar

---

#### `<CategorySelect />`
A searchable select for business/shop categories.

**Props:**
```ts
value: string
onChange: (value: string) => void
placeholder?: string
```

**Usage:** Register page, Stock add/edit form, LRDB shop filter

---

#### `<PrioritySelect />`
A select input for priority levels with color-coded options.

**Props:**
```ts
value: 'low' | 'medium' | 'high' | 'critical'
onChange: (value: string) => void
```

**Usage:** LRDB Queries, LRDB Alert creation

---

### 9.4 Chat Components

#### `<ChatBubble />`
A single message bubble in a chat thread.

**Props:**
```ts
messageId: string
senderId: string
senderName: string
senderAvatar?: string
content: string
timestamp: string
isOwn: boolean
isSystemMessage?: boolean
attachments?: Attachment[]
```

**Usage:** MSME Chat, LRDB Chat

---

#### `<ChatGroupListItem />`
A single entry in the chat group sidebar list.

**Props:**
```ts
groupId: string
groupName: string
lastMessage: string
lastMessageTime: string
unreadCount: number
labels?: string[]
isActive?: boolean
onClick: () => void
```

**Usage:** MSME Chat, LRDB Chat Groups

---

#### `<SOSButton />`
A prominent emergency request button that triggers an SOS message to the local chat group.

**Props:**
```ts
userId: string
groupId: string
onSOS: () => void
isLoading?: boolean
```

**Usage:** MSME Chat page, MSME Dashboard (quick actions)

---

### 9.5 Feedback & Status Components

#### `<StatusIndicator />`
A small dot + label for live operational status.

**Props:**
```ts
status: 'online' | 'offline' | 'degraded'
label?: string
pulse?: boolean    // Animated pulse for live/active status
```

**Usage:** Shop list, Dashboard header, Chat presence indicators

---

#### `<ActionConfirmDialog />`
A reusable confirmation modal wrapping shadcn `Dialog`.

**Props:**
```ts
open: boolean
onOpenChange: (open: boolean) => void
title: string
description: string
confirmLabel?: string
cancelLabel?: string
variant?: 'default' | 'destructive'
onConfirm: () => void
isLoading?: boolean
```

**Usage:** Delete stock item, resolve query, mark alert as actioned, send SOS

---

#### `<NotificationBanner />`
A top-of-page dismissible banner for system alerts.

**Props:**
```ts
type: 'info' | 'warning' | 'error' | 'success'
message: string
action?: { label: string; onClick: () => void }
onDismiss?: () => void
```

**Usage:** All pages — shown when a new critical alert arrives or a system event occurs

---

## 10. Navigation Structure

### MSME Sidebar / Bottom Nav

| Label | Icon | Route |
|---|---|---|
| Dashboard | `LayoutDashboard` | `/msme/$userId/dashboard` |
| My Stock | `Package` | `/msme/$userId/stock` |
| Safety Plan | `ClipboardList` | `/msme/$userId/bcp` |
| Alerts | `BellRing` | `/msme/$userId/alerts` |
| Community | `MessageSquare` | `/msme/$userId/chat` |
| Risk Profile | `ShieldAlert` | `/msme/$userId/risk` |
| Trends | `TrendingUp` | `/msme/$userId/trends` |
| Forecasts | `Calculator` | `/msme/$userId/forecasts` |
| Settings | `Settings` | `/msme/$userId/settings` |

Mobile bottom nav shows only the top 5 most-used items (Dashboard, Stock, Alerts, Community, Settings). The rest are accessible via a "More" overflow menu.

### LRDB Sidebar

| Label | Icon | Route |
|---|---|---|
| Shops | `Store` | `/lrdb/$officerId/shops` |
| Queries | `Inbox` | `/lrdb/$officerId/queries` |
| Chat | `MessageSquare` | `/lrdb/$officerId/chat` |
| Reports | `FileBarChart` | `/lrdb/$officerId/reports` |
| Estimation | `Banknote` | `/lrdb/$officerId/estimation` |
| Alerts | `BellRing` | `/lrdb/$officerId/alerts` |
| Settings | `Settings` | `/lrdb/$officerId/settings` |

---

## 11. Responsive Breakpoints

Tailwind default breakpoints are used. No custom breakpoints.

| Breakpoint | Width | Primary Target |
|---|---|---|
| `default` (mobile) | 0–639px | MSME mobile users |
| `sm` | 640px+ | MSME tablet |
| `md` | 768px+ | Transition zone |
| `lg` | 1024px+ | LRDB desktop, MSME desktop |
| `xl` | 1280px+ | LRDB primary viewport |

### Layout Shift Rules
- Sidebar is hidden on mobile; replaced by bottom tab bar (MSME) or top hamburger nav (LRDB).
- Card grids: `grid-cols-1` on mobile → `grid-cols-2` on `sm` → `grid-cols-3` or `grid-cols-4` on `lg`.
- Tables collapse to card-list view on mobile (each row becomes a card).
- Stat tiles: `grid-cols-2` on mobile → `grid-cols-4` on `lg`.

---

## 12. Chart Standards (MUI X Charts)

All charts use `@mui/x-charts`. No other charting library. Charts are wrapped in a `<SectionCard />` and given a consistent container height.

### Chart Color Palette

Charts use the following color sequence (in order):

```ts
const CHART_COLORS = [
  '#1A6B4A',  // brand-primary (green)
  '#2563EB',  // brand-secondary (blue)
  '#D97706',  // status-moderate (amber)
  '#DC2626',  // status-critical (red)
  '#7C3AED',  // purple
  '#0891B2',  // cyan
]
```

### Chart Usage by Page

| Page | Chart Type | Data Shown |
|---|---|---|
| MSME Dashboard | `BarChart` | Weekly risk level history |
| MSME Risk Profiling | `RadarChart` | Risk category breakdown |
| MSME Forecasts | `AreaChart` | Projected loss over time |
| MSME Trends | `LineChart` | Rainfall / disruption over months |
| LRDB Reports | `BarChart` | Sector-wise damage comparison |
| LRDB Estimation | `BarChart` + `PieChart` | Area loss distribution |
| LRDB Alerts | `LineChart` | Alert delivery engagement over time |

### Chart Rules
- Every chart must have a title (via `<SectionCard title />`) and axis labels.
- Charts must have a loading skeleton (`<LoadingSkeleton variant="card" />`) while data is fetching.
- Charts must have an empty state if data is unavailable.
- Do not use `ResponsiveChartContainer` without a defined `height` — always set explicit height (e.g. `height={300}`).

---

## 13. Form Validation Standards

All forms use **React Hook Form** with **Zod** schemas for validation.

- All Zod schemas live in `app/lib/schemas/` with one file per form (e.g. `registerSchema.ts`, `stockItemSchema.ts`).
- Error messages are displayed using shadcn `FormMessage` below each field.
- Submit buttons display a `Loader2` spinning icon (from Lucide) during submission and are disabled to prevent double-submit.
- Required fields are marked with a red asterisk `*` next to the label.
- All forms use `method="post"` and submit to Remix `action` functions — no client-side API calls from forms.

---

## 14. Animation & Transition Standards

- Page transitions: none (Remix handles navigation natively, no animation needed).
- Component mount: `transition-opacity duration-200` for modals and dropdowns (handled by shadcn/Radix automatically).
- Loading states: `animate-pulse` on skeleton components only.
- Alert banners: `transition-all duration-300` slide-in from top.
- No `framer-motion` or other animation libraries are to be introduced.

---

## 15. shadcn/ui Installation & Component Setup for Remix

### 15.1 Initial shadcn/ui Setup in Remix

shadcn/ui requires a one-time initialization before any components can be added. Run the following in the project root:

```bash
# 1. Install required dependencies
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge

# 2. Install Lucide React (icon library)
npm install lucide-react

# 3. Initialize shadcn/ui — this generates components.json and sets up the config
npx shadcn@latest init
```

During `npx shadcn@latest init`, select the following when prompted:

```
Which style would you like to use?    → Default
Which color would you like to use?    → Slate
Where is your global CSS file?        → app/styles/globals.css
Do you want to use CSS variables?     → Yes
Where is your tailwind.config file?   → tailwind.config.ts
Configure the import alias for components? → @/components
Configure the import alias for utils? → @/lib/utils
Are you using React Server Components? → No
```

This generates:
- `components.json` — shadcn config file at project root
- `app/lib/utils.ts` — contains the `cn()` helper function
- CSS variable definitions injected into `app/styles/globals.css`

---

### 15.2 Remix-Specific Tailwind Configuration

Remix requires Tailwind to be configured to scan the correct paths. Ensure `tailwind.config.ts` includes:

```ts
import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',   // All Remix route and component files
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        'brand-primary':       '#1A6B4A',
        'brand-primary-light': '#E8F5EF',
        'brand-primary-dark':  '#0F4530',
        'brand-secondary':     '#2563EB',
        'brand-secondary-light': '#EFF6FF',
        // Status colors
        'status-safe':         '#16A34A',
        'status-safe-bg':      '#F0FDF4',
        'status-moderate':     '#D97706',
        'status-moderate-bg':  '#FFFBEB',
        'status-high':         '#EA580C',
        'status-high-bg':      '#FFF7ED',
        'status-critical':     '#DC2626',
        'status-critical-bg':  '#FEF2F2',
        'status-offline':      '#6B7280',
        'status-offline-bg':   '#F9FAFB',
        // Surface colors
        'surface-primary':     '#FFFFFF',
        'surface-secondary':   '#F8FAFC',
        'surface-tertiary':    '#F1F5F9',
        'border-default':      '#E2E8F0',
        'border-strong':       '#CBD5E1',
        // Text colors
        'text-primary':        '#0F172A',
        'text-secondary':      '#475569',
        'text-tertiary':       '#94A3B8',
        'text-inverse':        '#FFFFFF',
      },
      fontFamily: {
        sans:     ['Inter', 'system-ui', 'sans-serif'],
        marathi:  ['Noto Sans Devanagari', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
```

Also ensure `app/root.tsx` imports the global stylesheet and Google Fonts:

```tsx
// app/root.tsx
import '~/styles/globals.css'

export function links() {
  return [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap',
    },
  ]
}
```

---

### 15.3 Adding shadcn/ui Components — Full Command Reference

Every component is added individually using `npx shadcn@latest add <component-name>`. Each command downloads the component file into `app/components/ui/`.

Run all of the following to install every component used in this project:

```bash
# Core interaction components
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add label
npx shadcn@latest add checkbox
npx shadcn@latest add switch
npx shadcn@latest add select
npx shadcn@latest add radio-group
npx shadcn@latest add slider

# Layout & containment
npx shadcn@latest add card
npx shadcn@latest add separator
npx shadcn@latest add scroll-area
npx shadcn@latest add sheet
npx shadcn@latest add collapsible
npx shadcn@latest add resizable

# Overlay & floating
npx shadcn@latest add dialog
npx shadcn@latest add alert-dialog
npx shadcn@latest add popover
npx shadcn@latest add tooltip
npx shadcn@latest add hover-card
npx shadcn@latest add dropdown-menu
npx shadcn@latest add context-menu

# Navigation
npx shadcn@latest add tabs
npx shadcn@latest add breadcrumb
npx shadcn@latest add navigation-menu
npx shadcn@latest add pagination

# Data display
npx shadcn@latest add table
npx shadcn@latest add badge
npx shadcn@latest add avatar
npx shadcn@latest add progress
npx shadcn@latest add skeleton
npx shadcn@latest add calendar
npx shadcn@latest add chart

# Feedback
npx shadcn@latest add alert
npx shadcn@latest add toast
npx shadcn@latest add sonner

# Search & command
npx shadcn@latest add command

# Form orchestration
npx shadcn@latest add form
```

Or run them all in a single command:

```bash
npx shadcn@latest add button input textarea label checkbox switch select radio-group slider card separator scroll-area sheet collapsible resizable dialog alert-dialog popover tooltip hover-card dropdown-menu context-menu tabs breadcrumb navigation-menu pagination table badge avatar progress skeleton calendar chart alert toast sonner command form
```

---

### 15.4 MUI X Charts Installation

```bash
# Install MUI X Charts and its peer dependencies
npm install @mui/x-charts @mui/material @emotion/react @emotion/styled
```

> **Note:** `@mui/material` and the emotion packages are required peer dependencies of MUI X Charts even if MUI Material components are not used directly in the project. Only `@mui/x-charts` components are to be used for data visualization — do not use any other MUI component outside of charts.

---

### 15.5 Stream SDK Installation (Chat, Voice & Video)

```bash
# Stream Chat SDK
npm install stream-chat stream-chat-react

# Stream Video SDK (for voice and video calls)
npm install @stream-io/video-react-sdk
```

Stream components must be initialized client-side only. In Remix, wrap Stream providers in a component that uses `typeof window !== 'undefined'` checks or use Remix's `ClientOnly` pattern to prevent SSR hydration errors:

```tsx
// app/components/shared/StreamClientProvider.tsx
import { ClientOnly } from 'remix-utils/client-only'
import { StreamChat } from 'stream-chat'
import { Chat } from 'stream-chat-react'

export function StreamClientProvider({ children, apiKey, user, token }) {
  const client = StreamChat.getInstance(apiKey)
  // connect user logic here
  return (
    <ClientOnly fallback={<LoadingSkeleton variant="chat" />}>
      {() => <Chat client={client}>{children}</Chat>}
    </ClientOnly>
  )
}
```

Install `remix-utils` for the `ClientOnly` helper:

```bash
npm install remix-utils
```

---

### 15.6 Remaining Package Installations

```bash
# Routing & forms
npm install react-hook-form zod @hookform/resolvers

# Internationalisation
npm install i18next react-i18next remix-i18next

# UUID generation
npm install uuid
npm install --save-dev @types/uuid

# Maps (Leaflet)
npm install leaflet react-leaflet
npm install --save-dev @types/leaflet

# Date utilities (used for timestamps, expiry tracking, forecasts)
npm install date-fns
```

---

### 15.7 Component File Location After Installation

After running the `npx shadcn@latest add` commands, files are placed at:

```
app/
└── components/
    └── ui/
        ├── button.tsx
        ├── card.tsx
        ├── dialog.tsx
        ├── badge.tsx
        ├── table.tsx
        ├── tabs.tsx
        ├── form.tsx
        ├── input.tsx
        ├── select.tsx
        ├── avatar.tsx
        ├── progress.tsx
        ├── skeleton.tsx
        ├── sheet.tsx
        ├── scroll-area.tsx
        ├── command.tsx
        ├── popover.tsx
        ├── tooltip.tsx
        ├── alert.tsx
        ├── toast.tsx
        ├── sonner.tsx
        ├── separator.tsx
        ├── breadcrumb.tsx
        ├── collapsible.tsx
        ├── checkbox.tsx
        ├── switch.tsx
        ├── dropdown-menu.tsx
        └── ...
```

These files are **owned by the project** — shadcn/ui copies the source into your repo. They can be edited directly if customization is needed, but the base styles and variants must remain consistent with the design tokens defined in Section 2.

---

### 15.8 Verifying the Setup

After all installations, run:

```bash
npm run dev
```

Then verify the following in the browser:

- [ ] Tailwind classes apply correctly on a test component
- [ ] shadcn `Button` renders with correct default styling
- [ ] Custom color tokens (`bg-brand-primary`, `text-status-critical`, etc.) resolve correctly
- [ ] Google Fonts (Inter + Noto Sans Devanagari) load in the network tab
- [ ] No hydration errors in the console related to Stream SDK

---

## 16. Dark Mode

Dark mode is **not in scope for v1**. The application ships in light mode only. The Tailwind config sets:

```ts
darkMode: 'class'  // declared but not toggled in v1
```

All color tokens are defined for light mode. This allows dark mode to be added in v2 without restructuring.

---

## 16. File & Folder Conventions

```
app/
├── components/
│   ├── ui/                  # shadcn/ui auto-generated components (do not edit)
│   └── shared/              # All custom reusable components listed in Section 9
│       ├── AppShell.tsx
│       ├── PageHeader.tsx
│       ├── SectionCard.tsx
│       ├── StatTile.tsx
│       ├── RiskBadge.tsx
│       ├── AlertCard.tsx
│       ├── SensitivityTag.tsx
│       ├── ShopCard.tsx
│       ├── QueryRow.tsx
│       ├── TimelineStep.tsx
│       ├── ChatBubble.tsx
│       ├── ChatGroupListItem.tsx
│       ├── SOSButton.tsx
│       ├── EmptyState.tsx
│       ├── LoadingSkeleton.tsx
│       ├── StatusIndicator.tsx
│       ├── ActionConfirmDialog.tsx
│       ├── NotificationBanner.tsx
│       ├── LanguageSelector.tsx
│       ├── CategorySelect.tsx
│       └── PrioritySelect.tsx
├── lib/
│   ├── schemas/             # Zod validation schemas
│   ├── utils.ts             # cn() helper and general utilities
│   └── constants.ts         # App-wide constants (risk levels, categories, etc.)
├── routes/                  # All Remix route files
└── styles/
    └── globals.css          # Tailwind base + shadcn CSS variables only
```

---

*This document is the single source of truth for all UI decisions. Any deviation requires explicit documentation of the reason.*
