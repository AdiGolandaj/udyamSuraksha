import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useParams, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { MessageSquare } from "lucide-react";

import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { generateStreamToken } from "~/lib/stream.server";

import { StreamClientProvider } from "~/components/shared/chat/StreamClientProvider";
import { ChatLayout } from "~/components/shared/chat/ChatLayout";
import { ChatSidebar } from "~/components/shared/chat/ChatSidebar";
import { EmptyState } from "~/components/shared/feedback/EmptyState";
import { LoadingSkeleton } from "~/components/shared/feedback/LoadingSkeleton";
import { useTranslation } from "~/hooks/useTranslation";

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Verify authentication and MSME role
  const user = await requireUser(request);

  if (user.role !== "msme") {
    return redirect(`/`);
  }

  // Verify the userId matches the authenticated user
  if (params.userId !== user.id) {
    throw new Error("Unauthorized");
  }

  // Fetch user's shop profile for regionCode
  const shopProfile = await db.shopProfile.findUnique({
    where: { userId: user.id },
    select: { regionCode: true },
  });

  if (!shopProfile) {
    throw new Error("Shop profile not found");
  }

  // Fetch user's chat groups
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
    streamToken,
    streamApiKey: process.env.STREAM_API_KEY!,
    groups,
  });
}

export default function MSMEChatPage() {
  const { user, streamToken, streamApiKey, groups } =
    useLoaderData<typeof loader>();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [callType, setCallType] = useState<"voice" | "video" | null>(null);

  const handleGroupSelect = (groupId: string) => {
    navigate(`/msme/${userId}/chat/${groupId}`);
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
      <ChatLayout role="msme" userId={user.id} activeGroupId={undefined}>
        {/* Left panel — group list */}
        <ChatSidebar
          role="msme"
          userId={user.id}
          activeGroupId={undefined}
          groups={groups}
          onGroupSelect={handleGroupSelect}
        />

        {/* Right panel — empty state */}
        <div className="flex-1 flex items-center justify-center p-4 bg-surface-primary">
          <EmptyState
            icon={MessageSquare}
            title={t("chat.select-group-title")}
            description={t("chat.select-group-description")}
            size="lg"
          />
        </div>
      </ChatLayout>
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
