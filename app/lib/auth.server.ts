import { redirect } from "@remix-run/node";
import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import { sessionStorage } from "~/lib/session.server";
import { db } from "~/lib/db.server";
import { v4 as uuidv4 } from "uuid";

export type SessionUser = {
  id: string;
  role: "msme" | "lrdb";
  name: string;
  email: string;
  avatar?: string;
  language: "en" | "mr" | "hi";
  emailNotificationsEnabled?: boolean;
};

export const authenticator = new Authenticator<SessionUser>(sessionStorage);

authenticator.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL!,
    },
    async ({ profile }) => {
      const email = profile.emails[0].value;
      const existingUser = await db.user.findUnique({ where: { email } });

      if (existingUser) {
        return {
          id: existingUser.id,
          role: existingUser.role.toLowerCase() as "msme" | "lrdb",
          name: existingUser.name,
          email: existingUser.email,
          avatar: existingUser.avatarUrl ?? undefined,
          language: (existingUser.language ?? "en") as "en" | "mr" | "hi",
        };
      }

      const id = uuidv4();
      await db.user.create({
        data: {
          id,
          role:      "MSME",
          name:      profile.displayName,
          email,
          avatarUrl: profile.photos?.[0]?.value ?? null,
          language:  "en",
        },
      });

      return {
        id,
        role:     "msme" as const,
        name:     profile.displayName,
        email,
        avatar:   profile.photos?.[0]?.value ?? undefined,
        language: "en" as const,
      };
    }
  ),
  "google"
);

export async function requireUser(request: Request): Promise<SessionUser> {
  return authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
}

export const requireAuthenticatedUser = requireUser;

export async function requireRole(
  request: Request,
  role: "msme" | "lrdb"
): Promise<SessionUser> {
  const user = await requireUser(request);
  if (user.role !== role) throw redirect("/login");
  return user;
}
