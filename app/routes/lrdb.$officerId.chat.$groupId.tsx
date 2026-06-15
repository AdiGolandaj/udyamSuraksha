import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useParams,
  useNavigate,
  useFetcher,
} from "@remix-run/react";
import { useState } from "react";
import { Phone, Video } from "lucide-react";

import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { generateStreamToken } from "~/lib/stream.server";

import { StreamClientProvider } from "~/components/shared/chat/StreamClientProvider";
import { ChatLayout } from "~/components/shared/chat/ChatLayout";
import { ChatSidebar } from "~/components/shared/chat/ChatSidebar";
import { ChatThread } from "~/components/shared/chat/ChatThread";
import { VideoCallModal } from "~/components/shared/chat/VideoCallModal";
import { SOSActivePanel } from "~/components/shared/chat/SOSActivePanel"

import { LoadingSkeleton } from "~/components/shared/feedback/LoadingSkeleton";
import { ErrorCard } from "~/components/shared/feedback/ErrorCard";
import { useTranslation } from "~/hooks/useTranslation";
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = ({ data }: any) => [
  {
    title: `${data?.chatGroup?.name || "Chat"} | DisasterShield`,
  },
];

interface ChatGroupThreadData {
  id: string;
  streamChannelId: string;
  name: string;
  groupType: "LRDB_COORDINATION" | "LOCAL_MSME" | "DIRECT_MESSAGE" | "SOS_EMERGENCY";
  regionCode: string;
  createdAt: string;
  isActive?: boolean;
  sosDetails?: {
    shopName: string;
    ownerName: string;
    location: string;
    latitude?: number;
    longitude?: number;
    createdAt: string;
  };
  labels: Array<{
    id: string;
    label: string;
  }>;
  _count: {
    members: number;
  };
}

interface ChatThreadLoaderData {
  officerId: string;
  officer: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
  lrdbProfile: {
    regionCode: string;
    district: string;
  };
  streamToken: string;
  streamApiKey: string;
  chatGroup: ChatGroupThreadData;
  isMemberOfGroup: boolean;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    // Require LRDB role
    const officer = await requireRole(request, "lrdb");

    // Verify officer ID matches params
    if (officer.id !== params.officerId) {
      throw new Response("Unauthorized", { status: 403 });
    }

    const { groupId } = params;
    if (!groupId) {
      throw new Response("Group ID is required", { status: 400 });
    }

    // Fetch LRDB profile
    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
      select: {
        regionCode: true,
        district: true,
      },
    });

    if (!lrdbProfile) {
      throw new Response("LRDB profile not found", { status: 404 });
    }

    // Fetch chat group
    const chatGroup = await db.chatGroup.findUnique({
      where: { id: groupId },
      include: {
        labels: {
          select: {
            id: true,
            label: true,
          },
        },
        _count: { select: { members: true } },
      },
    });

    if (!chatGroup) {
      throw new Response("Chat group not found", { status: 404 });
    }

    // Check if officer is member of this group
    const isMember = await db.chatGroupMember.findFirst({
      where: {
        chatGroupId: groupId,
        userId: officer.id,
      },
    });

    if (!isMember) {
      throw new Response("Unauthorized", { status: 403 });
    }

    // Generate Stream token server-side
    const streamToken = await generateStreamToken(officer.id);

    return json<ChatThreadLoaderData>({
      officerId: officer.id,
      officer: {
        id: officer.id,
        name: officer.name ?? null,
        avatar: officer.avatar ?? null,
      },
      lrdbProfile,
      streamToken,
      streamApiKey: process.env.STREAM_API_KEY!,
      chatGroup: {
        id: chatGroup.id,
        streamChannelId: chatGroup.streamChannelId,
        name: chatGroup.name,
        groupType: chatGroup.groupType,
        regionCode: chatGroup.regionCode,
        createdAt: chatGroup.createdAt.toISOString(),
        isActive: chatGroup.isActive,
        labels: chatGroup.labels,
        _count: chatGroup._count,
      },
      isMemberOfGroup: !!isMember,
    });
  } catch (error) {
    console.error("LRDB Chat Thread Loader Error:", error);
    throw error;
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }

  const officer = await requireRole(request, "lrdb");
  const formData = await request.formData();
  const intent = formData.get("intent");

  // TODO: Implement broadcast action
  // This will send a broadcast message to all MSME owners in the region
  if (intent === "broadcast") {
    const subject = formData.get("subject");
    const message = formData.get("message");
    const regionCode = formData.get("regionCode");
    const categoryFilter = formData.get("categoryFilter");

    // TODO: Create Alert record, AlertRecipient records, send Stream messages
    return json({ success: true });
  }

  throw new Response("Unknown action", { status: 400 });
};

export default function LRDBChatThreadPage() {
  const {
    officerId,
    officer,
    lrdbProfile,
    streamToken,
    streamApiKey,
    chatGroup,
  } = useLoaderData<typeof loader>();
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [callType, setCallType] = useState<"voice" | "video" | null>(null);

  const handleGroupSelect = (newGroupId: string) => {
    navigate(`/lrdb/${officerId}/chat/${newGroupId}`);
  };

  const handleVoiceCall = () => {
    setCallType("voice");
  };

  const handleVideoCall = () => {
    setCallType("video");
  };

  if (!groupId) {
    return <ErrorCard title="Error" message="Group ID is required" />;
  }

  return (
    <StreamClientProvider
      apiKey={streamApiKey}
      userId={officer.id}
      token={streamToken}
      userData={{
        id: officer.id,
        name: officer.name ?? '',
        image: officer.avatar ?? undefined,
        role: "lrdb",
        regionCode: lrdbProfile.regionCode,
      }}
    >
      <ChatLayout role="lrdb" userId={officer.id} activeGroupId={groupId}>
        {/* Left panel — group list */}
        <ChatSidebar
          role="lrdb"
          userId={officer.id}
          activeGroupId={groupId}
          groups={[{
            id: chatGroup.id,
            name: chatGroup.name,
            streamChannelId: chatGroup.streamChannelId,
            groupType: chatGroup.groupType,
            memberCount: chatGroup._count.members,
          }]}
          showLabelFilter={true}
          showSOSTab={true}
          onGroupSelect={handleGroupSelect}
        />

        {/* Right panel — chat thread */}
        <div className="flex flex-1">
          <div className="flex-1 flex flex-col">
            <ChatThread
              groupId={groupId}
              groupName={chatGroup.name}
              role="lrdb"
              userId={officer.id}
              groupType={chatGroup.groupType}
              onVoiceCall={handleVoiceCall}
              onVideoCall={handleVideoCall}
            />
          </div>

          {/* SOS Active Panel (right side, desktop only) */}
          {chatGroup.groupType === "SOS_EMERGENCY" && chatGroup.isActive && (
            <div className="hidden lg:flex w-80 border-l border-border-default flex-col">
              <SOSActivePanel
                groupId={groupId}
                onCallOwner={handleVoiceCall}
                onDispatchResponse={() => {
                  // TODO: Update SOS status
                }}
              />
            </div>
          )}
        </div>
      </ChatLayout>

      {/* Voice / Video call overlay */}
      {callType && (
        <VideoCallModal
          callId={`${groupId}-${callType}-${Date.now()}`}
          callType={callType}
          userId={officer.id}
          token={streamToken}
          onLeave={() => setCallType(null)}
        />
      )}
    </StreamClientProvider>
  );
}
