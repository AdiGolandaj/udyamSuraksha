# COMPONENTS.md
# DisasterShield — Reusable Component Master Reference

---

## 1. Component Architecture Rules

1. **Every component listed in this document must be built once and only once.** If a page needs a variation, extend via props — never duplicate the component.
2. **All shared components live in `app/components/shared/`.** Page-specific one-off components may be co-located in the route file only if they are provably never reused anywhere else.
3. **shadcn/ui components live in `app/components/ui/`.** Never modify them — compose them inside shared components instead.
4. **Every component must be typed with TypeScript.** No `any` types. Props interfaces are defined in the same file as the component.
5. **Every component that accepts children must define `children: React.ReactNode` explicitly.**
6. **Every interactive component must handle its loading, empty, and error states.**
7. **No component fetches its own data.** Data is passed via props from the route loader. Components are pure presentational or handle local UI state only.
8. **All text rendered in components must use the `t()` i18n function.** No hardcoded English strings.

---

## 2. Component Directory Structure

```
app/components/
├── ui/                          # shadcn/ui (auto-generated, do not edit)
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   └── ...
│
└── shared/                      # All custom reusable components
    │
    ├── layout/
    │   ├── AppShell.tsx
    │   ├── PageHeader.tsx
    │   ├── SectionCard.tsx
    │   ├── MobileSideDrawer.tsx
    │   └── BottomTabBar.tsx
    │
    ├── data-display/
    │   ├── StatTile.tsx
    │   ├── RiskBadge.tsx
    │   ├── AlertCard.tsx
    │   ├── SensitivityTag.tsx
    │   ├── ShopCard.tsx
    │   ├── QueryRow.tsx
    │   ├── TimelineStep.tsx
    │   ├── TrendChip.tsx
    │   ├── StockItemRow.tsx
    │   ├── ForecastScenarioCard.tsx
    │   └── ReportSummaryCard.tsx
    │
    ├── chat/
    │   ├── StreamClientProvider.tsx
    │   ├── ChatLayout.tsx
    │   ├── ChatSidebar.tsx
    │   ├── ChatGroupListItem.tsx
    │   ├── ChatThread.tsx
    │   ├── ChatBubble.tsx
    │   ├── ChatInput.tsx
    │   ├── ChatLabelFilter.tsx
    │   ├── SOSButton.tsx
    │   ├── CallBar.tsx
    │   └── VideoCallModal.tsx
    │
    ├── forms/
    │   ├── LanguageSelector.tsx
    │   ├── CategorySelect.tsx
    │   ├── PrioritySelect.tsx
    │   ├── SensitivityMultiSelect.tsx
    │   ├── LocationPicker.tsx
    │   └── NotificationToggleGroup.tsx
    │
    └── feedback/
        ├── EmptyState.tsx
        ├── LoadingSkeleton.tsx
        ├── StatusIndicator.tsx
        ├── ActionConfirmDialog.tsx
        ├── NotificationBanner.tsx
        └── ErrorCard.tsx
```

---

## 3. Layout Components

---

### `AppShell`
**File:** `app/components/shared/layout/AppShell.tsx`

The root authenticated layout. Renders the sidebar (desktop) or bottom tab bar + hamburger drawer (mobile) alongside the main content area. Every authenticated page is wrapped in this component via the Remix layout shell routes (`msme.$userId.tsx`, `lrdb.$officerId.tsx`).

```ts
interface AppShellProps {
  role: 'msme' | 'lrdb'
  userId: string                    // UUIDv4 of the current user
  userName: string
  userAvatar?: string
  userEmail: string
  language: 'en' | 'mr' | 'hi'
  unreadAlertCount?: number         // Badge count on Alerts nav item
  unreadChatCount?: number          // Badge count on Chat nav item
  children: React.ReactNode
}
```

**Behavior:**
- `lg` and above: fixed left sidebar (240px wide), scrollable main content area to the right.
- Below `lg`: top header bar with hamburger icon + `MobileSideDrawer`. MSME role additionally shows `BottomTabBar`.
- Nav items are derived from `role`. MSME gets 9 nav items; LRDB gets 7.
- Active nav item is highlighted using `useLocation()` to match the current path.
- User avatar + name shown at the bottom of the sidebar with a logout button.
- `unreadAlertCount` and `unreadChatCount` render numeric badge overlays on their respective nav icons.

**Uses:** `MobileSideDrawer`, `BottomTabBar`, `LanguageSelector`, shadcn `ScrollArea`, `Avatar`, `Tooltip`

**Used by:** `msme.$userId.tsx`, `lrdb.$officerId.tsx` (layout shell routes only)

---

### `PageHeader`
**File:** `app/components/shared/layout/PageHeader.tsx`

Consistent top section rendered at the top of every page's content area, inside `AppShell`.

```ts
interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ElementType            // Lucide icon component
  action?: React.ReactNode            // Primary CTA slot (Button or Form)
  breadcrumb?: Array<{
    label: string
    href?: string
  }>
}
```

**Behavior:**
- Renders breadcrumb (if provided) above the title using shadcn `Breadcrumb`.
- Icon (if provided) renders inline left of the title at 24px.
- Action slot renders right-aligned on desktop, full-width below title on mobile.
- `subtitle` renders in `text-text-secondary` below the title.

**Used by:** Every page inside both MSME and LRDB modules.

---

### `SectionCard`
**File:** `app/components/shared/layout/SectionCard.tsx`

A styled container for logical sections within a page. Wraps shadcn `Card`. All dashboard sections, form sections, and data panels use this.

```ts
interface SectionCardProps {
  title?: string
  subtitle?: string
  icon?: React.ElementType
  headerAction?: React.ReactNode      // Optional right-aligned action in the header
  children: React.ReactNode
  className?: string
  noPadding?: boolean                 // For tables and lists that need edge-to-edge content
  collapsible?: boolean               // Wraps content in shadcn Collapsible if true
  defaultOpen?: boolean               // Controls Collapsible default state
}
```

**Used by:** All pages — dashboard tiles, stock sections, BCP sections, report panels, estimation panels.

---

### `MobileSideDrawer`
**File:** `app/components/shared/layout/MobileSideDrawer.tsx`

Full-height slide-in drawer containing the complete navigation, triggered by the hamburger menu in the top header on mobile. Used for both MSME and LRDB on small screens.

```ts
interface MobileSideDrawerProps {
  role: 'msme' | 'lrdb'
  userId: string
  userName: string
  userAvatar?: string
  open: boolean
  onClose: () => void
}
```

**Uses:** shadcn `Sheet`, `Avatar`, `Separator`

---

### `BottomTabBar`
**File:** `app/components/shared/layout/BottomTabBar.tsx`

Fixed bottom navigation bar for MSME users on mobile. Shows the 5 most-used nav items. A "More" overflow item opens `MobileSideDrawer` for the remaining items.

```ts
interface BottomTabBarProps {
  userId: string
  unreadAlertCount?: number
  unreadChatCount?: number
}
```

**Fixed tabs:** Dashboard, Stock, Alerts, Community, More

**Used by:** `AppShell` (mobile, MSME role only)

---

## 4. Data Display Components

---

### `StatTile`
**File:** `app/components/shared/data-display/StatTile.tsx`

A single metric display tile. Used in dashboard summary rows and estimation overviews.

```ts
interface StatTileProps {
  label: string
  value: string | number
  icon: React.ElementType
  unit?: string                       // e.g. '₹', '%', 'items'
  trend?: {
    value: number                     // Absolute or percentage change
    direction: 'up' | 'down'
    label: string                     // e.g. 'vs last week'
    invertColor?: boolean             // true when up = bad (e.g. loss increase)
  }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  isLoading?: boolean
  onClick?: () => void                // Makes tile clickable (navigates to detail)
}
```

**Variants map to background colors:**
- `default` → `surface-secondary`
- `success` → `status-safe-bg`
- `warning` → `status-moderate-bg`
- `danger` → `status-critical-bg`
- `info` → `brand-secondary-light`

**Uses:** `TrendChip`, `LoadingSkeleton` (when `isLoading`)

**Used by:** MSME Dashboard, LRDB Estimation, LRDB Reports, MSME Forecasts, MSME Risk Profiling

---

### `RiskBadge`
**File:** `app/components/shared/data-display/RiskBadge.tsx`

Displays a risk or operational status level with consistent color coding, icon, and label. The single source of truth for all risk/status rendering in the app.

```ts
type RiskLevel = 'safe' | 'moderate' | 'high' | 'critical' | 'offline'

interface RiskBadgeProps {
  level: RiskLevel
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showLabel?: boolean                 // Default true
  pulse?: boolean                     // Animated pulse for live critical state
}
```

**Level → Display Map:**

| Level | Icon | Label | Background | Text |
|---|---|---|---|---|
| `safe` | `ShieldCheck` | Safe | `status-safe-bg` | `status-safe` |
| `moderate` | `AlertTriangle` | Moderate Risk | `status-moderate-bg` | `status-moderate` |
| `high` | `AlertTriangle` | High Risk | `status-high-bg` | `status-high` |
| `critical` | `AlertOctagon` | Critical | `status-critical-bg` | `status-critical` |
| `offline` | `WifiOff` | Offline | `status-offline-bg` | `status-offline` |

**Uses:** shadcn `Badge`

**Used by:** MSME Dashboard, MSME Alerts, MSME Risk Profiling, LRDB Shop List, LRDB Shop Detail, LRDB Queries, LRDB Reports

---

### `AlertCard`
**File:** `app/components/shared/data-display/AlertCard.tsx`

Displays a single disaster alert. The primary card used on the Alerts page and in the Dashboard alert feed.

```ts
interface AlertAction {
  label: string
  actionType: 'mark-secured' | 'notify-employees' | 'request-support' | 'confirm'
  isCompleted?: boolean
}

interface AlertCardProps {
  alertId: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string                    // e.g. 'Flood', 'Wind', 'Power Outage'
  issuedAt: string                    // ISO timestamp
  affectedItems: string[]             // Stock item names
  summary: string                     // AI-generated summary paragraph
  actions?: AlertAction[]
  isRead?: boolean
  isExpanded?: boolean                // Controls collapsed/expanded state
  language?: 'en' | 'mr' | 'hi'
  onActionClick?: (actionType: string) => void
  href?: string                       // Link to full alert detail page
}
```

**Behavior:**
- Unread alerts have a colored left border matching severity.
- `affectedItems` renders as a row of `SensitivityTag` components.
- Actions render as a row of ghost `Button` components at the card bottom.
- Collapsed by default on list pages; expanded on detail pages (`isExpanded=true`).
- Timestamp formatted relative (e.g. "2 hours ago") using `date-fns`.

**Uses:** `RiskBadge`, `SensitivityTag`, shadcn `Card`, `Button`, `Collapsible`

**Used by:** MSME Alerts page, MSME Dashboard, LRDB Alerts page

---

### `SensitivityTag`
**File:** `app/components/shared/data-display/SensitivityTag.tsx`

A small colored badge representing a stock item's disaster sensitivity classification.

```ts
type SensitivityType =
  | 'water' | 'heat' | 'fragile'
  | 'perishable' | 'flammable'
  | 'theft' | 'humidity'

interface SensitivityTagProps {
  type: SensitivityType
  size?: 'sm' | 'md'
  showIcon?: boolean
}
```

**Type → Display Map:**

| Type | Label | Icon | BG | Text |
|---|---|---|---|---|
| `water` | Water-sensitive | `Droplets` | `#EFF6FF` | `#1D4ED8` |
| `heat` | Heat-sensitive | `Thermometer` | `#FFF7ED` | `#C2410C` |
| `fragile` | Fragile | `AlertTriangle` | `#FDF4FF` | `#7E22CE` |
| `perishable` | Perishable | `Clock` | `#F0FDF4` | `#15803D` |
| `flammable` | Flammable | `Flame` | `#FEF2F2` | `#B91C1C` |
| `theft` | Theft-prone | `ShieldOff` | `#FEFCE8` | `#A16207` |
| `humidity` | Humidity-sensitive | `Wind` | `#F0F9FF` | `#0369A1` |

**Uses:** shadcn `Badge`

**Used by:** `AlertCard`, `StockItemRow`, MSME Stock page, MSME Risk Profiling, LRDB Shop Detail

---

### `ShopCard`
**File:** `app/components/shared/data-display/ShopCard.tsx`

Displays an MSME shop entry. Used in the LRDB Shop List page and in LRDB context where a shop is referenced.

```ts
interface ShopCardProps {
  shopId: string
  shopName: string
  ownerName: string
  category: string
  location: string
  riskLevel: RiskLevel
  contactNumber?: string
  lastActive?: string                 // ISO timestamp
  isOffline?: boolean
  onContact?: () => void              // Opens direct message to this shop
  href: string                        // Link to shop detail page
}
```

**Behavior:**
- `RiskBadge` shown top-right of card.
- "Contact" button bottom-right calls `onContact` prop, opening the direct message flow via Stream.
- Offline shops render with reduced opacity and `isOffline` state.
- `lastActive` shown as relative time using `date-fns`.

**Uses:** `RiskBadge`, `StatusIndicator`, shadcn `Card`, `Button`, `Avatar`

**Used by:** LRDB Shop List, LRDB Shop Detail (header)

---

### `QueryRow`
**File:** `app/components/shared/data-display/QueryRow.tsx`

A single row in the LRDB Queries table. Renders as a full table row on desktop and as a card on mobile.

```ts
type QueryPriority = 'low' | 'medium' | 'high' | 'critical'
type QueryStatus = 'pending' | 'under-review' | 'assigned' | 'resolved' | 'escalated'

interface QueryRowProps {
  queryId: string
  shopName: string
  shopId: string
  queryType: string                   // e.g. 'Flood Assistance', 'Power Outage'
  priority: QueryPriority
  status: QueryStatus
  submittedAt: string                 // ISO timestamp
  href: string                        // Link to query detail
}
```

**Priority Badge Colors:**

| Priority | Background | Text |
|---|---|---|
| `low` | `#F0FDF4` | `#15803D` |
| `medium` | `#FFFBEB` | `#D97706` |
| `high` | `#FFF7ED` | `#EA580C` |
| `critical` | `#FEF2F2` | `#DC2626` |

**Status Badge Colors:**

| Status | Background | Text |
|---|---|---|
| `pending` | `#F1F5F9` | `#475569` |
| `under-review` | `#EFF6FF` | `#1D4ED8` |
| `assigned` | `#FDF4FF` | `#7E22CE` |
| `resolved` | `#F0FDF4` | `#15803D` |
| `escalated` | `#FEF2F2` | `#DC2626` |

**Uses:** shadcn `Badge`, `TableRow`, `TableCell`

**Used by:** LRDB Queries page

---

### `TimelineStep`
**File:** `app/components/shared/data-display/TimelineStep.tsx`

A single step in a checklist or timeline. Used in BCP (before/during/after phases), alert action steps, and recovery timelines.

```ts
interface TimelineStepProps {
  stepNumber: number
  title: string
  description: string
  isCompleted?: boolean
  isActive?: boolean                  // Highlighted as the current step
  isOptional?: boolean
  onToggle?: (completed: boolean) => void   // Makes step interactive (checkbox)
  children?: React.ReactNode          // Slot for nested sub-steps
}
```

**Behavior:**
- Completed steps show a filled green circle with a checkmark.
- Active step shows a pulsing ring.
- Incomplete steps show a numbered gray circle.
- If `onToggle` is provided, the step title is clickable to toggle completion.
- Nested `children` render indented below the step.

**Uses:** shadcn `Checkbox`, `Collapsible`

**Used by:** MSME BCP page, MSME Alerts (action steps), LRDB Reports (recovery timeline)

---

### `TrendChip`
**File:** `app/components/shared/data-display/TrendChip.tsx`

A compact directional trend indicator showing change value with an arrow icon.

```ts
interface TrendChipProps {
  value: number                       // Numeric change value
  unit?: string                       // e.g. '%', '₹', 'items'
  direction: 'up' | 'down'
  label?: string                      // e.g. 'vs last month'
  invertColor?: boolean               // true when up = bad (loss, risk)
  size?: 'sm' | 'md'
}
```

**Color Logic:**
- Default: `up` = green (`status-safe`), `down` = red (`status-critical`)
- `invertColor=true`: `up` = red, `down` = green (used for loss/risk metrics)

**Uses:** `TrendingUp` / `TrendingDown` Lucide icons

**Used by:** `StatTile`, MSME Forecasts, LRDB Estimation, LRDB Reports

---

### `StockItemRow`
**File:** `app/components/shared/data-display/StockItemRow.tsx`

A single inventory item row in the Stock Management page. Renders as a table row on desktop and a card on mobile.

```ts
interface StockItemRowProps {
  itemId: string
  name: string
  category: string
  quantity: number
  unit: string                        // e.g. 'kg', 'units', 'litres'
  estimatedValue: number              // In INR ₹
  sensitivities: SensitivityType[]
  vulnerabilityScore: number          // 0–100
  expiryDate?: string                 // ISO date, for perishables
  storageLocation?: string
  onEdit?: () => void
  onDelete?: () => void
  href: string                        // Link to item detail
}
```

**Behavior:**
- `sensitivities` renders as a row of `SensitivityTag` components (max 3 shown inline, rest in tooltip).
- `vulnerabilityScore` renders as a colored `Progress` bar (green < 40, amber 40–70, red > 70).
- Expiry within 7 days renders with `status-critical` background highlight.
- Edit and delete actions in a `DropdownMenu`.

**Uses:** `SensitivityTag`, `TrendChip`, shadcn `Progress`, `DropdownMenu`, `Badge`

**Used by:** MSME Stock Management page

---

### `ForecastScenarioCard`
**File:** `app/components/shared/data-display/ForecastScenarioCard.tsx`

Displays a single disaster scenario with estimated financial and operational impact.

```ts
interface ForecastScenarioCardProps {
  scenarioId: string
  disasterType: string                // e.g. 'Flood', '3-Day Power Outage'
  probability: 'low' | 'medium' | 'high'
  estimatedLoss: number               // INR ₹
  affectedItemCount: number
  estimatedDowntimeDays: number
  recoveryTimelineDays: number
  topAffectedItems: Array<{
    name: string
    estimatedDamage: number
  }>
  aiNarrative: string                 // LLM-generated paragraph
  isExpanded?: boolean
}
```

**Uses:** `RiskBadge`, `SensitivityTag`, shadcn `Card`, `Collapsible`, `Progress`

**Used by:** MSME Estimates & Forecasts page

---

### `ReportSummaryCard`
**File:** `app/components/shared/data-display/ReportSummaryCard.tsx`

A summary card for a disaster report entry in the LRDB Reports page.

```ts
interface ReportSummaryCardProps {
  reportId: string
  reportTitle: string
  disasterType: string
  affectedZone: string
  reportDate: string                  // ISO date
  totalShopsAffected: number
  estimatedTotalLoss: number          // INR ₹
  severity: RiskLevel
  status: 'draft' | 'published' | 'archived'
  href: string
}
```

**Uses:** `RiskBadge`, shadcn `Card`, `Badge`

**Used by:** LRDB Reports page

---

## 5. Chat Components

---

### `StreamClientProvider`
**File:** `app/components/shared/chat/StreamClientProvider.tsx`

Initializes the Stream Chat client and provides it to all child chat components. Must wrap all chat UI. Client-side only — uses `ClientOnly` from `remix-utils`.

```ts
interface StreamClientProviderProps {
  apiKey: string
  userId: string                      // UUIDv4 — must match Stream user ID
  token: string                       // Server-generated Stream token
  userData: {
    id: string
    name: string
    image?: string
  }
  children: React.ReactNode
}
```

**Behavior:**
- Calls `StreamChat.getInstance(apiKey)` and `connectUser(userData, token)` on mount.
- Calls `disconnectUser()` on unmount to prevent memory leaks.
- Shows `LoadingSkeleton variant="chat"` while connecting.
- Wrapped in `ClientOnly` to prevent SSR errors.

---

### `ChatLayout`
**File:** `app/components/shared/chat/ChatLayout.tsx`

The two-panel chat layout: group list sidebar on the left, active chat thread on the right. Used by both MSME and LRDB chat pages.

```ts
interface ChatLayoutProps {
  role: 'msme' | 'lrdb'
  userId: string
  activeGroupId?: string              // Currently selected group UUIDv4
  children: React.ReactNode           // Renders the active ChatThread
}
```

**Behavior:**
- Desktop: 320px left panel (`ChatSidebar`) + flexible right panel (`ChatThread`).
- Mobile: Full-screen group list by default. Selecting a group navigates to the thread view (back button returns to list).
- LRDB variant shows label filter tabs above the group list.

**Uses:** `ChatSidebar`, `ChatLabelFilter`

---

### `ChatSidebar`
**File:** `app/components/shared/chat/ChatSidebar.tsx`

The scrollable list of chat groups/channels the user belongs to.

```ts
interface ChatSidebarProps {
  role: 'msme' | 'lrdb'
  userId: string
  activeGroupId?: string
  searchQuery?: string
  onGroupSelect: (groupId: string) => void
}
```

**Behavior:**
- Fetches the user's channel list from Stream using `useChatContext`.
- Renders each group as a `ChatGroupListItem`.
- Search input at top filters groups by name.
- LRDB variant shows `ChatLabelFilter` above the list.
- Shows `EmptyState` if no groups are found.
- Shows `LoadingSkeleton variant="list"` while loading.

**Uses:** `ChatGroupListItem`, `ChatLabelFilter`, `EmptyState`, `LoadingSkeleton`, shadcn `ScrollArea`, `Input`

---

### `ChatGroupListItem`
**File:** `app/components/shared/chat/ChatGroupListItem.tsx`

A single entry in the chat group sidebar list.

```ts
interface ChatGroupListItemProps {
  groupId: string
  groupName: string
  lastMessage: string
  lastMessageTime: string             // ISO timestamp
  unreadCount: number
  participantCount?: number
  labels?: string[]                   // LRDB only: e.g. ['Emergency', 'Flood Alert']
  isActive?: boolean
  isSOSActive?: boolean               // Renders red pulsing indicator
  onClick: () => void
}
```

**Behavior:**
- Active group highlighted with `brand-primary-light` background.
- `unreadCount > 0` shows a badge with count.
- `isSOSActive` shows a pulsing red `Siren` icon.
- Labels render as small chips (first 2 shown, rest in tooltip).
- `lastMessage` truncated to one line.
- Time shown as relative ("2m ago", "Yesterday").

**Uses:** `StatusIndicator`, shadcn `Avatar`, `Badge`, `Tooltip`

---

### `ChatThread`
**File:** `app/components/shared/chat/ChatThread.tsx`

The main message thread view for an active channel.

```ts
interface ChatThreadProps {
  groupId: string
  groupName: string
  participantCount?: number
  labels?: string[]
  onVoiceCall?: () => void
  onVideoCall?: () => void
  role: 'msme' | 'lrdb'
}
```

**Behavior:**
- Subscribes to the Stream channel using `useChannel`.
- Renders messages as `ChatBubble` components in a `ScrollArea`.
- Auto-scrolls to the latest message on new message arrival.
- Shows typing indicators from Stream's built-in typing events.
- Header shows group name, participant count, voice call and video call icon buttons.
- `ChatInput` fixed at the bottom.
- System messages (e.g. "User joined the group") render as centered gray text.
- Date separators between messages from different days.

**Uses:** `ChatBubble`, `ChatInput`, `CallBar`, shadcn `ScrollArea`, `Avatar`, `Tooltip`

---

### `ChatBubble`
**File:** `app/components/shared/chat/ChatBubble.tsx`

A single message bubble in a chat thread.

```ts
interface Attachment {
  type: 'image' | 'document' | 'location'
  url: string
  name?: string
}

interface ChatBubbleProps {
  messageId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  timestamp: string                   // ISO timestamp
  isOwn: boolean                      // true = right-aligned (sent by current user)
  isSystemMessage?: boolean           // Center-aligned gray system messages
  isSOSMessage?: boolean              // Red highlighted SOS message
  attachments?: Attachment[]
  deliveryStatus?: 'sent' | 'delivered' | 'read'   // Own messages only
}
```

**Behavior:**
- Own messages: right-aligned, `brand-primary` background, white text.
- Others' messages: left-aligned, `surface-tertiary` background, `text-primary`.
- SOS messages: full-width red banner with `Siren` icon regardless of sender.
- Avatar shown only for others' messages (not repeated for consecutive messages from same sender).
- Attachments render as thumbnail (image) or file chip (document) below message text.
- Timestamp shown on hover.

---

### `ChatInput`
**File:** `app/components/shared/chat/ChatInput.tsx`

The message composition input bar at the bottom of the chat thread.

```ts
interface ChatInputProps {
  channelId: string
  userId: string
  placeholder?: string
  onSendMessage: (content: string, attachments?: File[]) => Promise<void>
  onTyping?: () => void
  showSOSButton?: boolean             // MSME only
  onSOS?: () => void
  isDisabled?: boolean
}
```

**Behavior:**
- Textarea auto-grows up to 4 lines then scrolls.
- Enter sends (Shift+Enter for newline).
- Attachment button opens file picker (images and PDFs only).
- Typing indicator fires `onTyping` on keystroke (debounced 1s).
- SOS button (if `showSOSButton`) renders as a red icon button left of the send button.

**Uses:** `SOSButton`, shadcn `Textarea`, `Button`, `Tooltip`

---

### `ChatLabelFilter`
**File:** `app/components/shared/chat/ChatLabelFilter.tsx`

A horizontal scrollable row of label filter chips for LRDB chat group filtering.

```ts
interface ChatLabelFilterProps {
  labels: string[]                    // All available labels
  activeLabels: string[]              // Currently selected labels
  onLabelToggle: (label: string) => void
  onClearAll: () => void
}
```

**Available Labels:** Emergency, Flood Alert, Power Outage, Transport Support, Medical Assistance, Volunteer Coordination, Government Notice, High Priority, Resolved, Pending Action

**Used by:** `ChatSidebar` (LRDB role only)

---

### `SOSButton`
**File:** `app/components/shared/chat/SOSButton.tsx`

A prominent emergency SOS trigger button. Sends a pre-formatted SOS message to the user's local chat group and triggers an in-app notification to nearby MSMEs and the LRDB.

```ts
interface SOSButtonProps {
  userId: string
  groupId: string
  shopName: string
  location: string
  onSOS: (message: string) => Promise<void>
  isLoading?: boolean
  variant?: 'full' | 'icon'          // full = button with label, icon = icon only in ChatInput
}
```

**Behavior:**
- `variant="full"`: Large red button with `Siren` icon and "Send SOS" label.
- `variant="icon"`: Small icon-only button in `ChatInput`.
- Clicking opens `ActionConfirmDialog` confirming the SOS before sending.
- On confirm: sends a formatted SOS message to the Stream channel and calls `onSOS`.
- Button is disabled for 60 seconds after sending (cooldown) to prevent spam.
- Cooldown shows a countdown timer on the button.

**Uses:** `ActionConfirmDialog`, shadcn `Button`

**Used by:** MSME Chat page, MSME Dashboard (quick actions section)

---

### `CallBar`
**File:** `app/components/shared/chat/CallBar.tsx`

An in-thread banner that appears when a voice or video call is active in the current channel.

```ts
interface CallBarProps {
  callType: 'voice' | 'video'
  callerName: string
  onJoin: () => void
  onDecline: () => void
  isIncoming: boolean
}
```

**Behavior:**
- Incoming call: pulsing green banner at top of `ChatThread` with "Join" and "Decline" buttons.
- Ongoing call (user already joined): compact bar showing participants and "Leave" button.

**Used by:** `ChatThread`

---

### `VideoCallModal`
**File:** `app/components/shared/chat/VideoCallModal.tsx`

Full-screen overlay for active voice and video calls using Stream Video SDK.

```ts
interface VideoCallModalProps {
  callId: string
  callType: 'voice' | 'video'
  userId: string
  token: string
  onLeave: () => void
}
```

**Behavior:**
- Uses `@stream-io/video-react-sdk` `StreamCall` and `StreamVideo` providers.
- Video call: shows participant video tiles in a grid.
- Voice call: shows participant avatars with audio waveform indicator.
- Controls bar: mute, camera toggle, screen share (video only), leave call.
- Wrapped in `ClientOnly` to prevent SSR errors.

**Uses:** Stream Video SDK components, shadcn `Dialog` (as overlay container), `Avatar`

---

## 6. Form Components

---

### `LanguageSelector`
**File:** `app/components/shared/forms/LanguageSelector.tsx`

Runtime language switcher. Submits to the settings action to update the session language preference.

```ts
interface LanguageSelectorProps {
  currentLanguage: 'en' | 'mr' | 'hi'
  variant?: 'full' | 'compact'        // full = flag + name, compact = flag only
}
```

**Options:**
- 🇬🇧 English
- 🇮🇳 मराठी (Marathi)
- 🇮🇳 हिंदी (Hindi)

**Uses:** shadcn `Select` (full) or `DropdownMenu` (compact)

**Used by:** `AppShell` header, MSME/LRDB Settings page, Register page

---

### `CategorySelect`
**File:** `app/components/shared/forms/CategorySelect.tsx`

A searchable select for business/shop categories. Used during registration and in LRDB filters.

```ts
interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}
```

**Categories:**
Grocery, Pharmacy, Hardware, Textiles, Food & Beverage, Electronics, Agricultural Supplies, Timber & Wood, Dairy, Fuel & Gas, Stationery, Medical Equipment, General Store, Other

**Uses:** shadcn `Command` (searchable), `Popover`

**Used by:** Register page, MSME Settings, LRDB Shop List filter

---

### `PrioritySelect`
**File:** `app/components/shared/forms/PrioritySelect.tsx`

A select input for priority levels with color-coded options.

```ts
interface PrioritySelectProps {
  value: QueryPriority
  onChange: (value: QueryPriority) => void
  disabled?: boolean
}
```

**Uses:** shadcn `Select`

**Used by:** LRDB Queries (create/edit query), LRDB Alerts (alert creation)

---

### `SensitivityMultiSelect`
**File:** `app/components/shared/forms/SensitivityMultiSelect.tsx`

A multi-select input for choosing multiple disaster sensitivity types for a stock item.

```ts
interface SensitivityMultiSelectProps {
  selected: SensitivityType[]
  onChange: (selected: SensitivityType[]) => void
  disabled?: boolean
}
```

**Behavior:**
- Renders each sensitivity type as a toggleable chip.
- Selected chips render filled; unselected chips render outlined.
- Maximum 7 options (one per `SensitivityType`).

**Uses:** `SensitivityTag`, shadcn `Badge`

**Used by:** MSME Stock add/edit form

---

### `LocationPicker`
**File:** `app/components/shared/forms/LocationPicker.tsx`

A location input that accepts either manual text entry or browser geolocation.

```ts
interface LocationPickerProps {
  value: string                       // Human-readable location string
  onChange: (value: string) => void
  onCoordinatesChange?: (coords: { lat: number; lng: number }) => void
  disabled?: boolean
}
```

**Behavior:**
- "Use my location" button triggers `navigator.geolocation.getCurrentPosition()`.
- Coordinates are reverse-geocoded to a human-readable string (via a Remix action to avoid exposing API keys).
- Falls back to manual text input if geolocation is denied.

**Uses:** shadcn `Input`, `Button`

**Used by:** Register page, MSME Settings

---

### `NotificationToggleGroup`
**File:** `app/components/shared/forms/NotificationToggleGroup.tsx`

A group of toggle switches for notification channel preferences.

```ts
interface NotificationChannel {
  key: 'app' | 'sms' | 'whatsapp' | 'email'
  label: string
  description: string
  icon: React.ElementType
}

interface NotificationToggleGroupProps {
  channels: NotificationChannel[]
  enabled: Record<string, boolean>
  onChange: (key: string, value: boolean) => void
}
```

**Uses:** shadcn `Switch`, `Label`, `Separator`

**Used by:** MSME Settings, LRDB Settings

---

## 7. Feedback Components

---

### `EmptyState`
**File:** `app/components/shared/feedback/EmptyState.tsx`

Shown when a list or data view has no content to display.

```ts
interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  size?: 'sm' | 'md' | 'lg'
}
```

**Sizes:**
- `sm`: Icon 32px, compact text — for use inside cards.
- `md`: Icon 48px, standard text — default for page-level empty states.
- `lg`: Icon 64px, larger text — for full-page empty states (e.g. no alerts at all).

**Used by:** All list pages, chat sidebar, stock page, queries page

---

### `LoadingSkeleton`
**File:** `app/components/shared/feedback/LoadingSkeleton.tsx`

Contextual skeleton loaders for different content shapes.

```ts
type SkeletonVariant = 'card' | 'table' | 'stat' | 'list' | 'chat' | 'chart' | 'form'

interface LoadingSkeletonProps {
  variant: SkeletonVariant
  count?: number                      // Number of rows/cards to show
  className?: string
}
```

**Variant Shapes:**
- `card`: Rectangle with header line + 2 body lines.
- `table`: Header row + N data rows.
- `stat`: Square tile with number block.
- `list`: Avatar + two lines per row.
- `chat`: Mixed left/right bubble shapes.
- `chart`: Rectangle block representing chart area.
- `form`: Label + input pairs.

**Uses:** shadcn `Skeleton`

**Used by:** Every page — shown while Remix loader data is hydrating.

---

### `StatusIndicator`
**File:** `app/components/shared/feedback/StatusIndicator.tsx`

A small status dot with optional label showing live/online state.

```ts
interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'degraded' | 'active'
  label?: string
  pulse?: boolean                     // Animated pulse for live/active
  size?: 'sm' | 'md'
}
```

**Status → Color:**
- `online` → `status-safe`
- `offline` → `status-offline`
- `degraded` → `status-moderate`
- `active` → `brand-primary` (with pulse)

**Used by:** `ShopCard`, `ChatGroupListItem`, `AppShell` header, Dashboard

---

### `ActionConfirmDialog`
**File:** `app/components/shared/feedback/ActionConfirmDialog.tsx`

A reusable confirmation modal for destructive or irreversible actions.

```ts
interface ActionConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string               // Default: "Confirm"
  cancelLabel?: string                // Default: "Cancel"
  variant?: 'default' | 'destructive'
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
}
```

**Behavior:**
- `destructive` variant: confirm button is red.
- `isLoading`: confirm button shows `Loader2` spinner and is disabled.
- Pressing Escape or clicking overlay calls `onOpenChange(false)`.

**Uses:** shadcn `AlertDialog`, `Button`

**Used by:** `SOSButton`, delete stock item, resolve query, mark alert actioned, LRDB broadcast send

---

### `NotificationBanner`
**File:** `app/components/shared/feedback/NotificationBanner.tsx`

A top-of-page dismissible banner for system-level notifications and real-time alert arrivals.

```ts
interface NotificationBannerProps {
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  onDismiss?: () => void
  autoDismissMs?: number              // Auto-dismiss after N milliseconds (optional)
}
```

**Behavior:**
- Slides in from the top with `transition-all duration-300`.
- Dismiss button (X icon) always shown.
- `autoDismissMs` if set, auto-dismisses after the specified time with a progress indicator.
- Stacks if multiple banners are active (max 3 shown simultaneously).

**Uses:** shadcn `Alert`, `Button`

**Used by:** All pages — triggered via `useLoaderData` flash messages or real-time Stream events.

---

### `ErrorCard`
**File:** `app/components/shared/feedback/ErrorCard.tsx`

An inline error display for section-level failures (distinct from full-page `ErrorBoundary`).

```ts
interface ErrorCardProps {
  title?: string                      // Default: "Something went wrong"
  message: string
  onRetry?: () => void
  compact?: boolean                   // Smaller version for use inside cards
}
```

**Uses:** shadcn `Card`, `Button`, `AlertOctagon` icon

**Used by:** Any `SectionCard` that fails to load its data independently.

---

## 8. Component Usage Matrix

The following matrix shows which components are used on which pages. Use this as a checklist when building each page.

| Component | MSME Dashboard | MSME Stock | MSME BCP | MSME Alerts | MSME Chat | MSME Risk | MSME Trends | MSME Forecasts | MSME Settings | LRDB Shops | LRDB Queries | LRDB Chat | LRDB Reports | LRDB Estimation | LRDB Alerts | LRDB Settings |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `AppShell` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PageHeader` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `SectionCard` | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `StatTile` | ✓ | — | — | — | — | ✓ | — | ✓ | — | — | — | — | ✓ | ✓ | — | — |
| `RiskBadge` | ✓ | ✓ | — | ✓ | — | ✓ | — | ✓ | — | ✓ | ✓ | — | ✓ | — | ✓ | — |
| `AlertCard` | ✓ | — | — | ✓ | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| `SensitivityTag` | ✓ | ✓ | — | ✓ | — | ✓ | — | ✓ | — | — | — | — | — | — | — | — |
| `ShopCard` | — | — | — | — | — | — | — | — | — | ✓ | — | — | — | — | — | — |
| `QueryRow` | — | — | — | — | — | — | — | — | — | — | ✓ | — | — | — | — | — |
| `TimelineStep` | — | — | ✓ | ✓ | — | — | — | — | — | — | — | — | ✓ | — | — | — |
| `TrendChip` | ✓ | — | — | — | — | — | ✓ | ✓ | — | — | — | — | ✓ | ✓ | — | — |
| `StockItemRow` | — | ✓ | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `ForecastScenarioCard` | — | — | — | — | — | — | — | ✓ | — | — | — | — | — | — | — | — |
| `ReportSummaryCard` | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | — | — | — |
| `StreamClientProvider` | — | — | — | — | ✓ | — | — | — | — | — | — | ✓ | — | — | — | — |
| `ChatLayout` | — | — | — | — | ✓ | — | — | — | — | — | — | ✓ | — | — | — | — |
| `ChatGroupListItem` | — | — | — | — | ✓ | — | — | — | — | — | — | ✓ | — | — | — | — |
| `ChatBubble` | — | — | — | — | ✓ | — | — | — | — | — | — | ✓ | — | — | — | — |
| `SOSButton` | ✓ | — | — | — | ✓ | — | — | — | — | — | — | — | — | — | — | — |
| `VideoCallModal` | — | — | — | — | ✓ | — | — | — | — | — | — | ✓ | — | — | — | — |
| `EmptyState` | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| `LoadingSkeleton` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ActionConfirmDialog` | — | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ | — | ✓ | — | — | — | ✓ | — |
| `NotificationBanner` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `LanguageSelector` | — | — | — | — | — | — | — | — | ✓ | — | — | — | — | — | — | ✓ |
| `NotificationToggleGroup` | — | — | — | — | — | — | — | — | ✓ | — | — | — | — | — | — | ✓ |

---

## 9. Component Export Index

All shared components are exported from a single index file for clean imports.

```ts
// app/components/shared/index.ts

// Layout
export { AppShell } from './layout/AppShell'
export { PageHeader } from './layout/PageHeader'
export { SectionCard } from './layout/SectionCard'
export { MobileSideDrawer } from './layout/MobileSideDrawer'
export { BottomTabBar } from './layout/BottomTabBar'

// Data Display
export { StatTile } from './data-display/StatTile'
export { RiskBadge } from './data-display/RiskBadge'
export { AlertCard } from './data-display/AlertCard'
export { SensitivityTag } from './data-display/SensitivityTag'
export { ShopCard } from './data-display/ShopCard'
export { QueryRow } from './data-display/QueryRow'
export { TimelineStep } from './data-display/TimelineStep'
export { TrendChip } from './data-display/TrendChip'
export { StockItemRow } from './data-display/StockItemRow'
export { ForecastScenarioCard } from './data-display/ForecastScenarioCard'
export { ReportSummaryCard } from './data-display/ReportSummaryCard'

// Chat
export { StreamClientProvider } from './chat/StreamClientProvider'
export { ChatLayout } from './chat/ChatLayout'
export { ChatSidebar } from './chat/ChatSidebar'
export { ChatGroupListItem } from './chat/ChatGroupListItem'
export { ChatThread } from './chat/ChatThread'
export { ChatBubble } from './chat/ChatBubble'
export { ChatInput } from './chat/ChatInput'
export { ChatLabelFilter } from './chat/ChatLabelFilter'
export { SOSButton } from './chat/SOSButton'
export { CallBar } from './chat/CallBar'
export { VideoCallModal } from './chat/VideoCallModal'

// Forms
export { LanguageSelector } from './forms/LanguageSelector'
export { CategorySelect } from './forms/CategorySelect'
export { PrioritySelect } from './forms/PrioritySelect'
export { SensitivityMultiSelect } from './forms/SensitivityMultiSelect'
export { LocationPicker } from './forms/LocationPicker'
export { NotificationToggleGroup } from './forms/NotificationToggleGroup'

// Feedback
export { EmptyState } from './feedback/EmptyState'
export { LoadingSkeleton } from './feedback/LoadingSkeleton'
export { StatusIndicator } from './feedback/StatusIndicator'
export { ActionConfirmDialog } from './feedback/ActionConfirmDialog'
export { NotificationBanner } from './feedback/NotificationBanner'
export { ErrorCard } from './feedback/ErrorCard'
```

---

*Every page in the project must import from this index. Direct file imports (`../../components/shared/feedback/EmptyState`) are discouraged in favour of the barrel export (`~/components/shared`).*
