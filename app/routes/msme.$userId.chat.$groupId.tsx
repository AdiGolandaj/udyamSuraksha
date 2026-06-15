import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useParams, useNavigate, useFetcher } from "@remix-run/react";
import { useState } from "react";

import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  generateStreamToken,
  createSOSChannel,
  sendChannelMessage,
  addUserToChannel,
} from "~/lib/stream.server";
import { sendBroadcastMail } from "~/lib/mail.server";
import { apiClient } from "~/lib/api.server";

import { StreamClientProvider } from "~/components/shared/chat/StreamClientProvider";
import { ChatLayout } from "~/components/shared/chat/ChatLayout";
import { ChatSidebar } from "~/components/shared/chat/ChatSidebar";
import { ChatThread } from "~/components/shared/chat/ChatThread";
import { VideoCallModal } from "~/components/shared/chat/VideoCallModal";
import { NotificationBanner } from "~/components/shared/feedback/NotificationBanner";
import { useTranslation } from "~/hooks/useTranslation";

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Verify authentication and MSME role
  const user = await requireUser(request);

  if (user.role !== "msme") {
    return redirect(`/`);
  }

  if (params.userId !== user.id) {
    throw new Error("Unauthorized");
  }

  // Fetch shop profile
  const shopProfile = await db.shopProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      regionCode: true,
      shopName: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!shopProfile) {
    throw new Error("Shop profile not found");
  }

  // Fetch chat group and verify membership
  const chatGroup = await db.chatGroup.findUnique({
    where: { id: params.groupId! },
    include: {
      members: { select: { userId: true } },
      labels: true,
    },
  });

  if (!chatGroup) {
    throw redirect(`/msme/${user.id}/chat`);
  }

  // Check if user is a member of this group
  const isMember = chatGroup.members.some((m) => m.userId === user.id);
  if (!isMember) {
    throw redirect(`/msme/${user.id}/chat`);
  }

  // Fetch all chat groups for sidebar
  const chatGroups = await db.chatGroup.findMany({
    where: {
      members: { some: { userId: user.id } },
    },
    include: {
      labels: true,
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Generate Stream token server-side
  const streamToken = await generateStreamToken(user.id);

  const groups = chatGroups.map(g => ({
    id: g.id,
    name: g.name,
    streamChannelId: g.streamChannelId,
    groupType: g.groupType as 'LOCAL_MSME' | 'LRDB_COORDINATION' | 'DIRECT_MESSAGE' | 'SOS_EMERGENCY',
    memberCount: g._count.members,
    labels: g.labels.map(l => ({ id: l.id, name: l.label })),
  }))

  return json({
    user: {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      regionCode: shopProfile.regionCode,
    },
    shop: shopProfile,
    streamToken,
    streamApiKey: process.env.STREAM_API_KEY!,
    chatGroup,
    groups,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Verify authentication and MSME role
  const user = await requireUser(request);

  if (user.role !== "msme") {
    return json({ error: "Unauthorized" }, { status: 403 });
  }

  if (params.userId !== user.id) {
    return json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { intent, groupId, shopName, location, latitude, longitude } = body;

  if (intent === "send-sos") {
    try {
      // Fetch shop and location profile
      const shop = await db.shopProfile.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          regionCode: true,
          shopName: true,
          latitude: true,
          longitude: true,
        },
      });

      if (!shop) {
        return json({ error: "Shop not found" }, { status: 404 });
      }

      // Create SOS channel
      const sosChannelId = await createSOSChannel({
        regionCode: shop.regionCode,
        senderUserId: user.id,
        shopName: shop.shopName || shopName || "Unknown Shop",
        location: location || "Location unknown",
        latitude: latitude || shop.latitude || undefined,
        longitude: longitude || shop.longitude || undefined,
      });

      // Create ChatGroup record in MySQL
      const sosChatGroup = await db.chatGroup.create({
        data: {
          streamChannelId: sosChannelId,
          name: `🚨 SOS — ${shop.shopName || shopName}`,
          groupType: "SOS_EMERGENCY",
          regionCode: shop.regionCode,
          createdByUserId: user.id,
          members: {
            create: { userId: user.id },
          },
        },
      });

      // Send SOS message to the SOS channel
      await sendChannelMessage({
        channelId: sosChannelId,
        userId: user.id,
        text: `🚨 SOS ALERT — ${shop.shopName} needs immediate assistance!`,
        custom: {
          isSOS: true,
          shopName: shop.shopName,
          ownerName: user.name,
          location: location || "Location unknown",
          latitude: latitude || shop.latitude,
          longitude: longitude || shop.longitude,
          shopId: shop.id,
          timestamp: new Date().toISOString(),
        },
      });

      // Also send SOS message to the LOCAL_MSME group
      if (groupId) {
        const localGroup = await db.chatGroup.findUnique({
          where: { id: groupId },
          select: { streamChannelId: true },
        });

        if (localGroup) {
          await sendChannelMessage({
            channelId: localGroup.streamChannelId,
            userId: user.id,
            text: `🚨 SOS ALERT — ${shop.shopName} needs immediate assistance!`,
            custom: {
              isSOS: true,
              shopName: shop.shopName,
              ownerName: user.name,
              location: location || "Location unknown",
              latitude: latitude || shop.latitude,
              longitude: longitude || shop.longitude,
              shopId: shop.id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Fetch all LRDB officers in the region and send them emails
      const officers = await db.lRDBOfficer.findMany({
        where: { regionCode: shop.regionCode },
        include: { user: { select: { email: true, name: true } } },
      });

      if (officers.length > 0) {
        const coordinates = latitude && longitude ? `${latitude}, ${longitude}` : "N/A";
        const sosMessage = `🚨 SOS ALERT from ${shop.shopName} (Owner: ${user.name}). Location: ${location || "unknown"}. Coordinates: ${coordinates}. Time: ${new Date().toLocaleString()}.`;

        await sendBroadcastMail({
          recipients: officers.map(officer => ({
            email: officer.user.email,
            name: officer.user.name,
            userId: officer.userId,
          })),
          subject: `🚨 SOS Received — ${shop.shopName}, ${location}`,
          messageBody: sosMessage,
          officerName: 'DisasterShield System',
          region: shop.regionCode,
        }).catch((err) => {
          console.error('Failed to send SOS emails to officers:', err);
        });
      }

      // Trigger Python background jobs (non-blocking)
      apiClient.post("/alerts/sos-received", {
        sosChannelId,
        shopId: shop.id,
        regionCode: shop.regionCode,
        senderUserId: user.id,
      }).catch((err) => {
        console.error("Failed to trigger Python SOS jobs:", err);
      });

      return json({
        success: true,
        sosChannelId,
        sosChatGroupId: sosChatGroup.id,
      });
    } catch (error) {
      console.error("SOS action error:", error);
      return json({ error: "Failed to send SOS" }, { status: 500 });
    }
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function MSMEChatThreadPage() {
  const { user, streamToken, streamApiKey, chatGroup, groups } =
    useLoaderData<typeof loader>();
  const { userId, groupId } = useParams();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { t } = useTranslation();
  const [callType, setCallType] = useState<"voice" | "video" | null>(null);
  const [showSOSSuccess, setShowSOSSuccess] = useState(false);

  const handleGroupSelect = (newGroupId: string) => {
    navigate(`/msme/${userId}/chat/${newGroupId}`);
  };

  const handleSendSOS = async () => {
    fetcher.submit(
      {
        intent: "send-sos",
        groupId: groupId ?? "",
        shopName: chatGroup.name,
        location: "Shop location",
      },
      { method: "POST", encType: "application/json" }
    );
    setShowSOSSuccess(true);
  };

  return (
    <StreamClientProvider
      apiKey={streamApiKey}
      userId={user.id}
      token={streamToken}
      userData={{
        id: user.id,
        name: user.name,
        image: user.avatar,
        role: "msme",
        regionCode: user.regionCode,
      }}
    >
      {showSOSSuccess && (
        <NotificationBanner
          type="error"
          message={`${t("chat.sos-sent-title")} — ${t("chat.sos-sent-message")}`}
          onDismiss={() => setShowSOSSuccess(false)}
          autoDismissMs={5000}
        />
      )}

      <ChatLayout role="msme" userId={user.id} activeGroupId={groupId}>
        {/* Left panel — group list */}
        <ChatSidebar
          role="msme"
          userId={user.id}
          activeGroupId={groupId}
          groups={groups}
          onGroupSelect={handleGroupSelect}
        />

        {/* Right panel — chat thread */}
        {groupId && (
          <ChatThread
            groupId={groupId}
            groupName={chatGroup.name}
            role="msme"
            userId={user.id}
            onVoiceCall={() => setCallType("voice")}
            onVideoCall={() => setCallType("video")}
            onSendSOS={handleSendSOS}
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
  );
}

export function ErrorBoundary() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-h2 text-text-primary mb-2">
          {t("chat.error-title")}
        </h2>
        <p className="text-body text-text-secondary">
          {t("chat.error-message")}
        </p>
      </div>
    </div>
  );
}
