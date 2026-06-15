import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useParams, useNavigate, Outlet } from "@remix-run/react";
import { useState } from "react";
import { MessageSquare, Plus } from "lucide-react";

import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { generateStreamToken } from "~/lib/stream.server";

import { StreamClientProvider } from "~/components/shared/chat/StreamClientProvider";
import { ChatLayout } from "~/components/shared/chat/ChatLayout";
import { ChatSidebar } from "~/components/shared/chat/ChatSidebar";
import { ChatThread } from "~/components/shared/chat/ChatThread";
import { EmptyState } from "~/components/shared/feedback/EmptyState";
import { LoadingSkeleton } from "~/components/shared/feedback/LoadingSkeleton";
import { useTranslation } from "~/hooks/useTranslation";
import { Button } from "~/components/ui/button";
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Communication Hub | DisasterShield" },
];

interface ChatGroupData {
  id: string;
  streamChannelId: string;
  name: string;
  groupType: "LRDB_COORDINATION" | "LOCAL_MSME" | "DIRECT_MESSAGE" | "SOS_EMERGENCY";
  regionCode: string;
  createdAt: string;
  labels: Array<{
    id: string;
    label: string;
  }>;
  _count: {
    members: number;
  };
}

interface ChatLoaderData {
  officerId: string;
  officer: {
    id: string;
    name: string | null;
    avatar: string | null;
    email: string | null;
  };
  lrdbProfile: {
    regionCode: string;
    district: string;
    designation: string | null;
  };
  streamToken: string;
  streamApiKey: string;
  chatGroups: ChatGroupData[];
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    // Require LRDB role
    const officer = await requireRole(request, "lrdb");

    // Verify officer ID matches params
    if (officer.id !== params.officerId) {
      throw new Response("Unauthorized", { status: 403 });
    }

    // Fetch LRDB profile
    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
      select: {
        regionCode: true,
        district: true,
        designation: true,
      },
    });

    if (!lrdbProfile) {
      throw new Response("LRDB profile not found", { status: 404 });
    }

    // Fetch officer's chat groups (all types)
    const chatGroups = await db.chatGroup.findMany({
      where: {
        members: { some: { userId: officer.id } },
      },
      include: {
        labels: {
          select: {
            id: true,
            label: true,
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate Stream token server-side
    const streamToken = await generateStreamToken(officer.id);

    return json<ChatLoaderData>({
      officerId: officer.id,
      officer: {
        id: officer.id,
        name: officer.name,
        avatar: officer.avatar ?? null,
        email: officer.email,
      },
      lrdbProfile,
      streamToken,
      streamApiKey: process.env.STREAM_API_KEY!,
      chatGroups: chatGroups.map((g) => ({
        ...g,
        createdAt: g.createdAt.toISOString(),
      })) as ChatGroupData[],
    });
  } catch (error) {
    console.error("LRDB Chat Loader Error:", error);
    throw error;
  }
};

export default function LRDBChatPage() {
  const { officer, lrdbProfile, streamToken, streamApiKey, chatGroups } =
    useLoaderData<typeof loader>();
  const { officerId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [callType, setCallType] = useState<"voice" | "video" | null>(null);

  const handleGroupSelect = (groupId: string) => {
    navigate(`/lrdb/${officerId}/chat/${groupId}`);
  };

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
      <ChatLayout role="lrdb" userId={officer.id} activeGroupId={undefined}>
        {/* Left panel — group list */}
        <ChatSidebar
          role="lrdb"
          userId={officer.id}
          activeGroupId={undefined}
          groups={chatGroups.map((g) => ({
            id: g.id,
            name: g.name,
            streamChannelId: g.streamChannelId,
            groupType: g.groupType,
            memberCount: g._count.members,
          }))}
          showLabelFilter={true}
          showSOSTab={true}
          onGroupSelect={handleGroupSelect}
        />

        {/* Right panel — empty state or active thread */}
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <EmptyState
            icon={MessageSquare}
            title={t("selectCommunication")}
            description={t("selectCommunicationDesc")}
            size="lg"
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => navigate(`/lrdb/${officerId}/chat/new`)}
          >
            <Plus className="size-4" />
            {t("createNewGroup")}
          </Button>
        </div>
      </ChatLayout>
    </StreamClientProvider>
  );
}
