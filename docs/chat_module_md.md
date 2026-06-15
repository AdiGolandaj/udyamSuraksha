# CHAT_MODULE.md
# DisasterShield — Chat, Voice & Video Module Specification

---

## 1. Module Overview

The Chat Module is a cross-cutting feature used by both the MSME and LRDB roles. It provides real-time messaging, voice calls, video calls, SOS emergency broadcasting, and LRDB broadcast announcements — all powered by the **Stream SDK** (getstream.io).

This document covers:
- Stream SDK architecture and initialization
- Channel types, naming conventions, and membership rules
- Message types and rendering rules
- SOS emergency flow (end-to-end)
- Voice and video call flow
- LRDB broadcast flow
- Notification integration
- Component wiring and data flow per role

**Reference implementation:** `https://github.com/burakorkmez/streamify-video-calls`

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Chat messaging | `stream-chat` + `stream-chat-react` | Real-time messaging, channel management, typing indicators, read receipts |
| Voice & video calls | `@stream-io/video-react-sdk` | WebRTC-based voice and video calls within chat channels |
| Server-side token generation | `stream-chat` (Node, server-only) | Secure user token generation in Remix loaders |
| Client-side provider | `StreamChat.getInstance()` | Singleton Stream client on the browser |
| SSR protection | `remix-utils/client-only` `ClientOnly` | Prevents Stream SDK from running during server-side rendering |
| Channel metadata | MySQL (`ChatGroup`, `ChatGroupMember`, `ChatLabel`) | Persistent metadata — Stream owns messages, MySQL owns structure |

---

## 3. Installation

```bash
# Stream Chat SDK
npm install stream-chat stream-chat-react

# Stream Video SDK
npm install @stream-io/video-react-sdk

# Import Stream Chat CSS (required for default styles)
# Add to app/root.tsx:
import 'stream-chat-react/dist/css/v2/index.css'
```

Add to `.env` (Remix side):
```env
STREAM_API_KEY=your-stream-api-key
STREAM_API_SECRET=your-stream-api-secret
```

---

## 4. Stream User Identity

Every DisasterShield user registered in MySQL has a corresponding Stream user. The Stream user ID is the same as the MySQL `User.id` (UUIDv4). This ensures a single identity across both systems with no ID translation layer.

### Stream User Object Shape

```ts
// MSME Owner
{
  id: 'uuid-of-user',           // Same as MySQL User.id
  name: 'Ramesh Patil',
  image: 'https://...',         // Google avatar URL
  role: 'msme',
  shopName: 'Patil General Store',
  regionCode: 'pune-mulshi',
}

// LRDB Officer
{
  id: 'uuid-of-officer',
  name: 'Officer Suresh Desai',
  image: 'https://...',
  role: 'lrdb',
  district: 'Pune',
  designation: 'District Disaster Manager',
  regionCode: 'pune-mulshi',
}
```

### Server-Side User Upsert

When a user logs in for the first time or updates their profile, the Remix action calls the Stream server client to upsert the user:

```ts
// app/lib/stream.server.ts
import { StreamChat } from 'stream-chat'

const serverClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
)

export async function upsertStreamUser(user: {
  id: string
  name: string
  image?: string
  role: string
  regionCode: string
  [key: string]: string | undefined
}) {
  await serverClient.upsertUser(user)
}

export async function generateStreamToken(userId: string): Promise<string> {
  return serverClient.createToken(userId)
}

export async function deleteStreamUser(userId: string): Promise<void> {
  await serverClient.deleteUser(userId, { mark_messages_deleted: false })
}
```

---

## 5. Channel Types & Naming Conventions

Stream channels are identified by a `type` and an `id`. DisasterShield uses four channel types, each with a strict naming convention to ensure predictable, collision-free channel IDs.

### 5.1 Channel Type Definitions

| Channel Type | Stream Type | MySQL `ChatGroupType` | Description |
|---|---|---|---|
| Local MSME Community | `messaging` | `LOCAL_MSME` | Proximity-based group for MSME owners in the same region |
| LRDB Coordination | `team` | `LRDB_COORDINATION` | Officer-managed group for disaster response coordination |
| Direct Message | `messaging` | `DIRECT_MESSAGE` | 1-to-1 between an LRDB officer and an MSME owner |
| SOS Emergency | `livestream` | `SOS_EMERGENCY` | Emergency broadcast triggered by an MSME SOS |

### 5.2 Channel ID Naming Conventions

```
LOCAL_MSME group:       local-{regionCode}-{chatGroupUUID}
                        e.g. local-pune-mulshi-550e8400-e29b

LRDB_COORDINATION:      lrdb-{regionCode}-{chatGroupUUID}
                        e.g. lrdb-pune-mulshi-a1b2c3d4

DIRECT_MESSAGE:         dm-{lrdbOfficerUUID}-{msmeOwnerUUID}
                        e.g. dm-officer-uuid-owner-uuid
                        (always officer UUID first, owner UUID second)

SOS_EMERGENCY:          sos-{regionCode}-{unixTimestamp}
                        e.g. sos-pune-mulshi-1718200000
```

All channel IDs are stored in `ChatGroup.streamChannelId` in MySQL.

---

## 6. Channel Creation Rules

### 6.1 LOCAL_MSME Channel — Created on First Registration in a Region

When the first MSME owner in a `regionCode` completes registration:

```ts
// Called from Remix register action → app/lib/stream.server.ts
export async function createLocalMSMEChannel(params: {
  regionCode: string
  chatGroupId: string
  createdByUserId: string
  officerUserId?: string     // LRDB officer for this region (if exists)
}) {
  const channelId = `local-${params.regionCode}-${params.chatGroupId}`
  const channel = serverClient.channel('messaging', channelId, {
    name: `${params.regionCode} Community`,
    created_by_id: params.createdByUserId,
    regionCode: params.regionCode,
    channelType: 'LOCAL_MSME',
    members: [params.createdByUserId, params.officerUserId].filter(Boolean),
  })
  await channel.create()
  return channelId
}
```

Subsequent MSME owners in the same `regionCode` are added to the existing channel:

```ts
export async function addUserToChannel(channelId: string, userId: string) {
  const channel = serverClient.channel('messaging', channelId)
  await channel.addMembers([userId])
}
```

### 6.2 LRDB_COORDINATION Channel — Created by LRDB Officer

Created via the "New Group" button in the LRDB Chat page.

```ts
export async function createLRDBCoordinationChannel(params: {
  regionCode: string
  chatGroupId: string
  officerUserId: string
  groupName: string
  initialMemberIds: string[]
}) {
  const channelId = `lrdb-${params.regionCode}-${params.chatGroupId}`
  const channel = serverClient.channel('team', channelId, {
    name: params.groupName,
    created_by_id: params.officerUserId,
    regionCode: params.regionCode,
    channelType: 'LRDB_COORDINATION',
    members: params.initialMemberIds,
  })
  await channel.create()
  return channelId
}
```

### 6.3 DIRECT_MESSAGE Channel — Created on First Contact

Created when an LRDB officer clicks "Contact" on a shop, or when a shop owner initiates contact.

```ts
export async function getOrCreateDirectMessageChannel(params: {
  officerUserId: string
  msmeOwnerUserId: string
}) {
  // Sort to ensure consistent channel ID regardless of who initiates
  const channelId = `dm-${params.officerUserId}-${params.msmeOwnerUserId}`
  const channel = serverClient.channel('messaging', channelId, {
    members: [params.officerUserId, params.msmeOwnerUserId],
    created_by_id: params.officerUserId,
    channelType: 'DIRECT_MESSAGE',
  })
  await channel.create()
  return channelId
}
```

### 6.4 SOS_EMERGENCY Channel — Created on SOS Trigger

Created when an MSME owner sends an SOS. See Section 9 for the full SOS flow.

```ts
export async function createSOSChannel(params: {
  regionCode: string
  senderUserId: string
  shopName: string
  location: string
}) {
  const timestamp = Math.floor(Date.now() / 1000)
  const channelId = `sos-${params.regionCode}-${timestamp}`
  const channel = serverClient.channel('livestream', channelId, {
    name: `🚨 SOS — ${params.shopName}`,
    created_by_id: params.senderUserId,
    regionCode: params.regionCode,
    channelType: 'SOS_EMERGENCY',
    shopName: params.shopName,
    location: params.location,
    members: [params.senderUserId],
  })
  await channel.create()
  // Add all LRDB officers in this regionCode
  const officers = await db.lRDBOfficer.findMany({
    where: { regionCode: params.regionCode },
    select: { userId: true }
  })
  await channel.addMembers(officers.map(o => o.userId))
  return channelId
}
```

---

## 7. Client-Side Stream Initialization

### 7.1 Token Flow (Loader → Client)

Stream tokens are generated server-side in the chat route loader and passed to the client via `useLoaderData`. The secret never reaches the browser.

```ts
// app/routes/msme.$userId.chat.tsx — loader
export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const streamToken = await generateStreamToken(user.id)

  // Fetch user's chat groups from MySQL
  const chatGroups = await db.chatGroup.findMany({
    where: {
      members: { some: { userId: user.id } }
    },
    include: {
      labels: true,
      _count: { select: { members: true } }
    }
  })

  return json({
    user,
    streamToken,
    streamApiKey: process.env.STREAM_API_KEY!,
    chatGroups,
  })
}
```

### 7.2 StreamClientProvider

```tsx
// app/components/shared/chat/StreamClientProvider.tsx
import { useEffect, useState } from 'react'
import { StreamChat } from 'stream-chat'
import { Chat } from 'stream-chat-react'
import { ClientOnly } from 'remix-utils/client-only'
import { LoadingSkeleton } from '~/components/shared'

interface StreamClientProviderProps {
  apiKey: string
  userId: string
  token: string
  userData: {
    id: string
    name: string
    image?: string
    role: string
    regionCode: string
  }
  children: React.ReactNode
}

export function StreamClientProvider({
  apiKey, userId, token, userData, children
}: StreamClientProviderProps) {
  const [client, setClient] = useState<StreamChat | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const streamClient = StreamChat.getInstance(apiKey)

    streamClient
      .connectUser(userData, token)
      .then(() => setClient(streamClient))
      .catch(err => setError('Failed to connect to chat service'))

    return () => {
      streamClient.disconnectUser().catch(console.error)
    }
  }, [userId])  // Re-initialize only if userId changes

  if (error) {
    return (
      <ErrorCard
        title="Chat Unavailable"
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <ClientOnly fallback={<LoadingSkeleton variant="chat" count={5} />}>
      {() =>
        client ? (
          <Chat client={client} theme="str-chat__theme-light">
            {children}
          </Chat>
        ) : (
          <LoadingSkeleton variant="chat" count={5} />
        )
      }
    </ClientOnly>
  )
}
```

---

## 8. Chat Layout & Thread Components

### 8.1 MSME Chat Page Layout

```tsx
// app/routes/msme.$userId.chat.$groupId.tsx
export default function MSMEChatPage() {
  const { user, streamToken, streamApiKey, chatGroups } =
    useLoaderData<typeof loader>()
  const { groupId } = useParams()

  return (
    <StreamClientProvider
      apiKey={streamApiKey}
      userId={user.id}
      token={streamToken}
      userData={{
        id: user.id,
        name: user.name,
        image: user.avatarUrl,
        role: 'msme',
        regionCode: user.shopProfile.regionCode,
      }}
    >
      <ChatLayout role="msme" userId={user.id} activeGroupId={groupId}>
        {/* Left panel — group list */}
        <ChatSidebar
          role="msme"
          userId={user.id}
          activeGroupId={groupId}
          onGroupSelect={(id) => navigate(`/msme/${user.id}/chat/${id}`)}
        />

        {/* Right panel — active thread */}
        {groupId ? (
          <ChatThread
            groupId={groupId}
            groupName={activeGroup?.name}
            role="msme"
            onVoiceCall={() => setCallType('voice')}
            onVideoCall={() => setCallType('video')}
          />
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="Select a group"
            description="Choose a community group from the left to start chatting"
            size="lg"
          />
        )}
      </ChatLayout>

      {/* Voice / Video call overlay */}
      {callType && (
        <VideoCallModal
          callId={`${groupId}-${Date.now()}`}
          callType={callType}
          userId={user.id}
          token={streamToken}
          onLeave={() => setCallType(null)}
        />
      )}
    </StreamClientProvider>
  )
}
```

### 8.2 LRDB Chat Page Layout

Same pattern but with additional `ChatLabelFilter` and broadcast capabilities:

```tsx
// app/routes/lrdb.$officerId.chat.$groupId.tsx
// Additional props passed to ChatSidebar:
<ChatSidebar
  role="lrdb"
  userId={officer.id}
  activeGroupId={groupId}
  showLabelFilter={true}         // Renders ChatLabelFilter above group list
  showSOSTab={true}              // Renders SOS Active tab
  onGroupSelect={(id) => navigate(`/lrdb/${officer.id}/chat/${id}`)}
/>
```

---

## 9. Message Types & Rendering

Stream messages are plain objects. DisasterShield uses Stream's `message.type` and custom `message.custom` fields to differentiate message rendering.

### 9.1 Message Type Map

| Message Type | `message.type` | Custom Field | Rendered As |
|---|---|---|---|
| Normal text | `regular` | none | `ChatBubble` standard |
| SOS broadcast | `regular` | `custom.isSOS: true` | `ChatBubble isSOSMessage=true` — red full-width banner |
| System event | `system` | none | `ChatBubble isSystemMessage=true` — centered gray text |
| LRDB announcement | `regular` | `custom.isAnnouncement: true` | `ChatBubble` with pinned banner styling |
| Image attachment | `regular` | `attachments[].type: 'image'` | `ChatBubble` with image thumbnail |
| Document attachment | `regular` | `attachments[].type: 'file'` | `ChatBubble` with file chip |
| Location pin | `regular` | `custom.isLocation: true`, `custom.lat`, `custom.lng` | `ChatBubble` with mini Leaflet map embed |

### 9.2 SOS Message Format

When an SOS is triggered, the following message is sent to the SOS channel AND to the existing LOCAL_MSME channel:

```ts
// Message sent to Stream channel
{
  text: `🚨 SOS ALERT — ${shopName} needs immediate assistance!`,
  custom: {
    isSOS: true,
    shopName: shopName,
    ownerName: ownerName,
    location: locationString,
    latitude: lat,
    longitude: lng,
    shopId: shopId,
    timestamp: new Date().toISOString(),
  }
}
```

### 9.3 LRDB Announcement Message Format

```ts
{
  text: announcementBody,
  custom: {
    isAnnouncement: true,
    officerName: officerName,
    district: district,
    severity: 'HIGH',     // Maps to alert severity
    pinned: true,
  }
}
```

---

## 10. SOS Emergency Flow (End-to-End)

The SOS flow is the most critical user journey in the application. Every step is documented here.

```
TRIGGER
───────
MSME owner presses SOSButton (variant="full" on dashboard
or variant="icon" in ChatInput)
  │
  ▼
ActionConfirmDialog opens:
  Title: "Send Emergency SOS?"
  Description: "This will alert all nearby businesses and
                your LRDB officer immediately. Only use
                in a genuine emergency."
  Buttons: "Send SOS" (red) | "Cancel"
  │
  ▼ (on confirm)

CLIENT-SIDE (Remix action via useFetcher)
─────────────────────────────────────────
POST /msme/$userId/chat
Body: { intent: 'send-sos', groupId, shopName, location, lat, lng }
  │
  ▼

REMIX ACTION (server-side)
──────────────────────────
1. Generate SOS channel ID:
   sos-{regionCode}-{unixTimestamp}

2. Call stream.server.ts → createSOSChannel()
   - Creates new Stream 'livestream' channel
   - Adds MSME owner as member
   - Adds all LRDBOfficer.userId records for this regionCode

3. Write to MySQL:
   ChatGroup {
     streamChannelId: 'sos-pune-mulshi-1718200000',
     name: 'SOS — Patil General Store',
     groupType: 'SOS_EMERGENCY',
     regionCode: 'pune-mulshi',
     createdByUserId: userId,
   }
   ChatGroupMember { chatGroupId, userId }

4. Send SOS message to the SOS channel AND
   the existing LOCAL_MSME channel for this regionCode:
   message.custom.isSOS = true

5. Trigger email notification to all LRDB officers
   in regionCode via sendBroadcastMail()
   Subject: "🚨 SOS Received — {shopName}, {location}"
   Body: owner name, location, coordinates, Google Maps link

6. Return { success: true, sosChannelId }
  │
  ▼

CLIENT-SIDE (after action resolves)
────────────────────────────────────
7. SOSButton shows 60-second cooldown countdown
   (prevents spam — managed in component state)

8. NotificationBanner type="error" shown on Dashboard:
   "SOS sent. LRDB and nearby businesses have been alerted."

9. Navigate to SOS channel thread:
   /msme/$userId/chat/{sosChannelId}

LRDB SIDE (real-time, via Stream event)
────────────────────────────────────────
10. Stream delivers new message event to all
    LRDB officers connected to the LOCAL_MSME channel

11. LRDB Chat sidebar: ChatGroupListItem for this group
    shows isSOSActive=true (pulsing red Siren icon)

12. LRDB Chat SOS Active tab surfaces the SOS group
    at the top of the list

13. LRDB Dashboard (if implemented):
    NotificationBanner type="error" shows SOS alert

14. LRDB officer opens SOS thread → sees SOS message
    rendered as red full-width banner

15. SOS Active Panel (right side, desktop) shows:
    - Shop name + owner
    - Location + Google Maps link
    - Nearest hospital, police station (from LocationProfile)
    - "Dispatch Response Team" + "Call Owner" buttons

RESOLUTION
──────────
16. LRDB officer clicks "Dispatch Response Team"
    - Sends system message to SOS channel:
      "Response team dispatched by {officerName}"
    - Updates ChatGroup.isActive = false in MySQL
    - SOSButton cooldown clears for the MSME owner

17. SOS channel remains readable but is archived
    after 24 hours (APScheduler job)
```

---

## 11. Voice Call Flow

Voice calls use `@stream-io/video-react-sdk`. They are initiated from within a chat thread header or from the LRDB SOS Active Panel.

```
INITIATION
──────────
User clicks voice call icon button in ChatThread header
(or "Call Owner" in LRDB SOS Active Panel)
  │
  ▼
1. callId generated: `{channelId}-voice-{timestamp}`
2. VideoCallModal opens (callType='voice')

VideoCallModal mounts:
3. StreamVideo client initialized (client-only, wrapped in ClientOnly)
4. call = client.call('default', callId)
5. call.join({ create: true })

INCOMING CALL (other participants)
────────────────────────────────────
6. Stream delivers 'call.ring' event to all channel members
7. CallBar component renders at top of ChatThread for recipients:
   - "{callerName} is calling..."
   - "Join" (green) | "Decline" (red) buttons
8. Recipient clicks "Join" → VideoCallModal opens on their side
9. call.join() called — WebRTC connection established via Stream

ACTIVE CALL
──────────
10. VideoCallModal renders:
    - Voice call: participant avatars with audio waveform ring
    - Controls bar:
      - Mute / Unmute (MicrophoneButton from Stream SDK)
      - Speaker toggle
      - Leave Call (red, bottom-centre)
    - Participant count shown

LEAVE CALL
──────────
11. User clicks "Leave Call"
    - call.leave() called
    - VideoCallModal unmounts
    - If last participant: call ends automatically

12. System message posted to channel:
    "Call ended — {duration}"
```

---

## 12. Video Call Flow

Video calls follow the same flow as voice calls with additional video-specific controls.

```
All steps identical to voice call flow, with additions:

VideoCallModal (video variant) renders:
- Participant video tiles in a grid layout
  (1 participant: full screen, 2: side by side, 3+: grid)
- Dominant speaker highlighted with brand-primary border
- Controls bar (additional controls vs voice):
  - Camera On/Off (CameraButton from Stream SDK)
  - Microphone On/Off
  - Screen Share (ScreenShareButton from Stream SDK)
  - Leave Call

Stream SDK handles:
- WebRTC negotiation
- ICE candidate exchange
- Bandwidth adaptation
- Reconnection on network drop
```

---

## 13. LRDB Broadcast Flow

LRDB officers can send a broadcast message to all MSMEs in a region directly from the Chat page (Section 3.3 of LRDB_MODULE.md). This is distinct from a targeted alert — it is a direct message pushed into all LOCAL_MSME channels for the selected region.

```
LRDB officer clicks "Send Broadcast" in ChatThread header
  │
  ▼
Broadcast Composer Dialog opens
  │ Officer fills: subject, message body,
  │ target region, category filter, delivery channels
  │
  ▼
"Send Broadcast" → ActionConfirmDialog
  "This will notify {count} businesses via {channels}"
  │
  ▼ (on confirm)

Remix action POST /lrdb/$officerId/chat
intent: 'broadcast'
  │
  ▼
1. Write Alert record to MySQL:
   Alert {
     title: subject,
     severity: MEDIUM (default),
     category: OTHER,
     summary: messageBody,
     affectedRegions: regionCode,
     issuedByUserId: officerId,
   }

2. Write AlertRecipient for each targeted shop owner

3. Send Stream message to each LOCAL_MSME channel
   in the target region:
   message.custom.isAnnouncement = true
   message.custom.officerName = officerName
   message.custom.pinned = true

4. Pin the message in each channel (Stream pinMessage API)

5. Send email via sendBroadcastMail() to all
   recipients with notifyViaEmail = true

6. Write NotificationLog records for each recipient

7. Return redirect to Alert detail page for tracking
```

---

## 14. Real-Time Notification Triggers (Stream Events)

Stream emits real-time events that DisasterShield uses to update the UI without page reloads. These are handled in client-side components using Stream's React hooks.

### 14.1 Events Handled

| Stream Event | Where Handled | UI Update |
|---|---|---|
| `message.new` (in any channel) | `AppShell` via `useChatContext` | Increment `unreadChatCount` badge in nav |
| `message.new` (isSOS: true) | `AppShell` + LRDB Chat | Show `NotificationBanner type="error"` — SOS received |
| `message.new` (isAnnouncement: true) | MSME Chat + Dashboard | Show `NotificationBanner type="info"` — New LRDB announcement |
| `notification.message_new` | `AppShell` | Unread count badge on nav item |
| `channel.updated` | `ChatSidebar` | Refresh group list |
| `call.ring` | `ChatThread` | Show `CallBar` incoming call banner |
| `call.ended` | `ChatThread` | Dismiss `CallBar`, post duration system message |
| `typing.start` | `ChatThread` | Show typing indicator below input |
| `typing.stop` | `ChatThread` | Hide typing indicator |
| `member.added` | `ChatThread` header | Update participant count |

### 14.2 Global Event Listener in AppShell

```tsx
// app/components/shared/layout/AppShell.tsx
// Inside the component, after Stream client is available:

useEffect(() => {
  if (!streamClient) return

  const handleNewMessage = (event: Event) => {
    if (event.message?.custom?.isSOS) {
      showNotificationBanner({
        type: 'error',
        message: `🚨 SOS from ${event.message.custom.shopName}`,
        action: {
          label: 'View SOS',
          onClick: () => navigate(`/${role}/${userId}/chat/${event.channel_id}`)
        }
      })
    }
    // Increment unread count badge
    setUnreadChatCount(prev => prev + 1)
  }

  streamClient.on('message.new', handleNewMessage)
  return () => streamClient.off('message.new', handleNewMessage)
}, [streamClient])
```

---

## 15. Chat UI — Detailed Component Wiring

### 15.1 ChatThread — Stream Hooks Used

```tsx
// app/components/shared/chat/ChatThread.tsx
import {
  useChannelStateContext,
  useChannelActionContext,
  useMessageContext,
  MessageList,
  MessageInput,
  Thread,
  Window,
} from 'stream-chat-react'

export function ChatThread({ groupId, role, onVoiceCall, onVideoCall }) {
  // Channel state from Stream
  const { channel, messages, members, typing } = useChannelStateContext()
  const { sendMessage } = useChannelActionContext()

  return (
    <Window>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-default">
        <div>
          <h3 className="text-h3">{channel?.data?.name}</h3>
          <p className="text-caption text-text-secondary">
            {Object.keys(members).length} members
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={onVoiceCall}>
            <Phone className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onVideoCall}>
            <Video className="size-5" />
          </Button>
        </div>
      </div>

      {/* Messages — Stream's MessageList with custom ChatBubble renderer */}
      <ScrollArea className="flex-1">
        <MessageList
          Message={CustomChatBubble}   // Our ChatBubble component as renderer
          disableDateSeparator={false}
          messageActions={role === 'lrdb'
            ? ['pin', 'flag', 'delete', 'react']
            : ['react', 'flag']
          }
        />
      </ScrollArea>

      {/* Typing indicator */}
      {Object.keys(typing).length > 0 && (
        <p className="text-caption text-text-tertiary px-4 py-1">
          {Object.keys(typing).join(', ')} {Object.keys(typing).length === 1 ? 'is' : 'are'} typing...
        </p>
      )}

      {/* Input */}
      <ChatInput
        channelId={groupId}
        userId={currentUserId}
        showSOSButton={role === 'msme'}
        onSOS={handleSOS}
        onSendMessage={async (content) => {
          await sendMessage({ text: content })
        }}
      />
    </Window>
  )
}
```

### 15.2 Custom Message Renderer (ChatBubble as Stream renderer)

Stream's `MessageList` accepts a custom `Message` component. Our `ChatBubble` acts as this renderer:

```tsx
// CustomChatBubble wraps ChatBubble to extract Stream message props
function CustomChatBubble({ message }) {
  const { client } = useChatContext()
  const isOwn = message.user?.id === client.userID
  const isSOS = message.custom?.isSOS
  const isAnnouncement = message.custom?.isAnnouncement
  const isSystem = message.type === 'system'

  return (
    <ChatBubble
      messageId={message.id}
      senderId={message.user?.id}
      senderName={message.user?.name}
      senderAvatar={message.user?.image}
      content={message.text}
      timestamp={message.created_at}
      isOwn={isOwn}
      isSOSMessage={isSOS}
      isSystemMessage={isSystem}
      attachments={message.attachments}
      deliveryStatus={
        isOwn
          ? message.readBy?.length > 1
            ? 'read'
            : message.status === 'received'
            ? 'delivered'
            : 'sent'
          : undefined
      }
    />
  )
}
```

---

## 16. VideoCallModal — Stream Video SDK Wiring

```tsx
// app/components/shared/chat/VideoCallModal.tsx
import {
  StreamVideo,
  StreamCall,
  StreamVideoClient,
  useCall,
  useCallStateHooks,
  ParticipantView,
  CallControls,
} from '@stream-io/video-react-sdk'
import { ClientOnly } from 'remix-utils/client-only'
import '@stream-io/video-react-sdk/dist/css/styles.css'

export function VideoCallModal({ callId, callType, userId, token, onLeave }) {
  return (
    <ClientOnly fallback={null}>
      {() => (
        <VideoCallModalInner
          callId={callId}
          callType={callType}
          userId={userId}
          token={token}
          onLeave={onLeave}
        />
      )}
    </ClientOnly>
  )
}

function VideoCallModalInner({ callId, callType, userId, token, onLeave }) {
  const [client] = useState(() =>
    new StreamVideoClient({
      apiKey: window.__STREAM_API_KEY__,   // Injected via root.tsx loader
      user: { id: userId },
      token,
    })
  )

  const call = useMemo(
    () => client.call('default', callId),
    [client, callId]
  )

  useEffect(() => {
    call.join({ create: true })
    return () => { call.leave() }
  }, [call])

  return (
    // Full-screen overlay
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <CallLayout callType={callType} onLeave={onLeave} />
        </StreamCall>
      </StreamVideo>
    </div>
  )
}

function CallLayout({ callType, onLeave }) {
  const { useParticipants, useLocalParticipant } = useCallStateHooks()
  const participants = useParticipants()
  const localParticipant = useLocalParticipant()

  return (
    <>
      {/* Participant grid */}
      <div className={cn(
        "flex-1 grid gap-2 p-4",
        participants.length === 1 && "grid-cols-1",
        participants.length === 2 && "grid-cols-2",
        participants.length >= 3 && "grid-cols-2 lg:grid-cols-3",
      )}>
        {participants.map(p => (
          <ParticipantView
            key={p.sessionId}
            participant={p}
            // Voice call: hide video tracks, show avatar
            videoTrackType={callType === 'voice' ? undefined : 'videoTrack'}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex justify-center py-6">
        <CallControls onLeave={onLeave} />
      </div>
    </>
  )
}
```

---

## 17. Presence & Online Status

Stream tracks user online/offline status via WebSocket connection. This is surfaced in:

- `ChatGroupListItem` — `StatusIndicator` showing if the last message sender is online
- LRDB Shop Detail — `StatusIndicator` in the chat embed showing if the shop owner is currently online
- LRDB SOS Panel — online indicator for SOS sender

```tsx
// Reading presence in a component
import { useChatContext } from 'stream-chat-react'

function UserPresence({ userId }: { userId: string }) {
  const { client } = useChatContext()
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const user = client.state.users[userId]
    setIsOnline(user?.online ?? false)

    const handlePresence = (event) => {
      if (event.user?.id === userId) {
        setIsOnline(event.user.online)
      }
    }

    client.on('user.presence.changed', handlePresence)
    return () => client.off('user.presence.changed', handlePresence)
  }, [userId, client])

  return <StatusIndicator status={isOnline ? 'online' : 'offline'} />
}
```

---

## 18. Chat Data Sync — MySQL ↔ Stream

Stream is the source of truth for messages. MySQL is the source of truth for channel membership and metadata. The two systems stay in sync via these rules:

| Event | MySQL Write | Stream Write |
|---|---|---|
| New user registers | `ChatGroupMember` record created | `channel.addMembers([userId])` |
| User deletes account | `ChatGroupMember` records deleted | `channel.removeMembers([userId])` |
| New SOS triggered | `ChatGroup` (SOS type) created | `createSOSChannel()` |
| New LRDB group created | `ChatGroup` + `ChatGroupMember` created | `createLRDBCoordinationChannel()` |
| Officer labels a group | `ChatLabel` record created/deleted | `channel.update({ labels: [...] })` |
| LRDB broadcasts | `Alert` + `AlertRecipient` created | `channel.sendMessage({ custom.isAnnouncement: true })` |
| User joins region | Look up existing `ChatGroup` for `regionCode` | `channel.addMembers([userId])` |

---

## 19. Chat Module Route Files

```
app/routes/
├── msme.$userId.chat.tsx              # Layout + StreamClientProvider init
├── msme.$userId.chat.$groupId.tsx     # Active thread view
├── lrdb.$officerId.chat.tsx           # Layout + StreamClientProvider init
└── lrdb.$officerId.chat.$groupId.tsx  # Active thread view
```

### Loader Pattern for Chat Routes

```ts
// Both MSME and LRDB chat loaders follow this pattern:
export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request)

  // Generate Stream token server-side
  const streamToken = await generateStreamToken(user.id)

  // Fetch group metadata from MySQL
  const chatGroups = await db.chatGroup.findMany({
    where: { members: { some: { userId: user.id } } },
    include: { labels: true, _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // If a specific groupId is in params, fetch that group's MySQL metadata
  const activeGroup = params.groupId
    ? await db.chatGroup.findUnique({
        where: { id: params.groupId },
        include: { labels: true, members: { include: { user: true } } },
      })
    : null

  return json({
    user,
    streamToken,
    streamApiKey: process.env.STREAM_API_KEY!,
    chatGroups,
    activeGroup,
  })
}
```

---

## 20. Error Handling & Fallbacks

| Failure Scenario | Handling |
|---|---|
| Stream client fails to connect | `ErrorCard` shown in place of chat with "Retry" button |
| Token expired | Stream emits `connection.error` → Remix `useFetcher` re-fetches a new token from the loader |
| Message send fails | Stream SDK retries automatically (3 attempts). On final failure: `NotificationBanner type="error"` |
| Video call WebRTC failure | Stream SDK attempts ICE restart. On failure: `CallBar` shows "Connection lost — call ended" |
| SOS channel creation fails | `ActionConfirmDialog` error state shown — "SOS could not be sent. Please call LRDB directly: {phone}" |
| User offline (no WebSocket) | Stream queues messages and delivers on reconnect. `StatusIndicator status="offline"` shown |

---

## 21. Security Rules

1. **Stream tokens are always generated server-side.** The `STREAM_API_SECRET` never appears in client-side code.
2. **Channel membership is enforced by Stream's permission system.** A user cannot read or send to a channel they are not a member of.
3. **SOS channels include only the sender + LRDB officers.** Other MSME owners in the region receive the SOS message as a post in the LOCAL_MSME channel — they are not added to the SOS channel itself.
4. **LRDB officers cannot be added to channels by MSME owners.** Only the Remix server (via `stream.server.ts`) can call `addMembers` with officer user IDs.
5. **Message deletion is restricted.** MSME owners can only delete their own messages. LRDB officers can delete any message in channels they administer.
6. **Direct message channels are immutable in membership.** Once created with two members, no third party can be added to a `DIRECT_MESSAGE` channel.
