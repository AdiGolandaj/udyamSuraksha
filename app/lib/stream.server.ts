import { StreamChat } from "stream-chat";
import { db } from "./db.server";

// Server-side Stream client — secret never leaves the server
const serverClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

export async function generateStreamToken(userId: string): Promise<string> {
  return serverClient.createToken(userId);
}

export async function upsertStreamUser(user: {
  id: string;
  name: string;
  image?: string;
  role: string;
  regionCode: string;
  [key: string]: string | undefined;
}) {
  await serverClient.upsertUser(user);
}

export async function deleteStreamUser(userId: string): Promise<void> {
  await serverClient.deleteUser(userId, { mark_messages_deleted: false });
}

/**
 * Create a LOCAL_MSME channel for a region
 * Called when the first MSME owner in a region completes registration
 */
export async function createLocalMSMEChannel(params: {
  regionCode: string;
  chatGroupId: string;
  createdByUserId: string;
  officerUserId?: string;
}): Promise<string> {
  const channelId = `local-${params.regionCode}-${params.chatGroupId}`;
  const members = [params.createdByUserId];
  if (params.officerUserId) {
    members.push(params.officerUserId);
  }

  const channel = serverClient.channel("messaging", channelId, {
    name: `${params.regionCode} Community`,
    created_by_id: params.createdByUserId,
    regionCode: params.regionCode,
    channelType: "LOCAL_MSME",
    members,
  });

  await channel.create();
  return channelId;
}

/**
 * Ensure a Stream channel exists with the correct members.
 * All group types use "messaging" channel type for consistent permissions.
 * Safe to call repeatedly — create() is idempotent for the same type+id.
 */
export async function ensureStreamChannel(params: {
  channelId: string;
  memberIds: string[];
  name: string;
  groupType: string;
  createdByUserId: string;
}): Promise<void> {
  const channel = serverClient.channel("messaging", params.channelId, {
    name: params.name,
    created_by_id: params.createdByUserId,
    channelType: params.groupType,
    members: params.memberIds,
  });
  await channel.create();
}

/**
 * Add a user to an existing channel
 */
export async function addUserToChannel(
  channelId: string,
  userId: string
): Promise<void> {
  const channel = serverClient.channel("messaging", channelId);
  await channel.addMembers([userId]);
}

/**
 * Create a SOS emergency channel
 * Called when an MSME owner sends an SOS
 */
export async function createSOSChannel(params: {
  regionCode: string;
  senderUserId: string;
  shopName: string;
  location: string;
  latitude?: number;
  longitude?: number;
}): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const channelId = `sos-${params.regionCode}-${timestamp}`;

  const channel = serverClient.channel("livestream", channelId, {
    name: `🚨 SOS — ${params.shopName}`,
    created_by_id: params.senderUserId,
    regionCode: params.regionCode,
    channelType: "SOS_EMERGENCY",
    shopName: params.shopName,
    location: params.location,
    latitude: params.latitude,
    longitude: params.longitude,
    members: [params.senderUserId],
  });

  await channel.create();

  // Add all LRDB officers in this regionCode
  const officers = await db.lRDBOfficer.findMany({
    where: { regionCode: params.regionCode },
    select: { userId: true },
  });

  if (officers.length > 0) {
    await channel.addMembers(officers.map((o) => o.userId));
  }

  return channelId;
}

/**
 * Send a message to a channel
 */
export async function sendChannelMessage(params: {
  channelId: string;
  userId: string;
  text: string;
  custom?: Record<string, any>;
  attachments?: Array<{ type: string; url: string; title?: string }>;
}): Promise<string> {
  const channel = serverClient.channel("messaging", params.channelId);
  const response = await channel.sendMessage({
    text: params.text,
    custom: params.custom,
    attachments: params.attachments,
    user: { id: params.userId },
  });
  return response.message.id;
}

/**
 * Get or create a direct message channel between LRDB officer and MSME owner
 */
export async function getOrCreateDirectMessageChannel(params: {
  officerUserId: string;
  msmeOwnerUserId: string;
}): Promise<string> {
  const channelId = `dm-${params.officerUserId}-${params.msmeOwnerUserId}`;
  const channel = serverClient.channel("messaging", channelId, {
    members: [params.officerUserId, params.msmeOwnerUserId],
    created_by_id: params.officerUserId,
    channelType: "DIRECT_MESSAGE",
  });

  try {
    await channel.create();
  } catch (err: any) {
    // Channel might already exist, which is fine
    if (err.statusCode !== 409) {
      throw err;
    }
  }

  return channelId;
}

/**
 * Create an LRDB coordination channel
 */
export async function createLRDBCoordinationChannel(params: {
  regionCode: string;
  chatGroupId: string;
  officerUserId: string;
  groupName: string;
  initialMemberIds: string[];
}): Promise<string> {
  const channelId = `lrdb-${params.regionCode}-${params.chatGroupId}`;
  const channel = serverClient.channel("team", channelId, {
    name: params.groupName,
    created_by_id: params.officerUserId,
    regionCode: params.regionCode,
    channelType: "LRDB_COORDINATION",
    members: params.initialMemberIds,
  });

  await channel.create();
  return channelId;
}
