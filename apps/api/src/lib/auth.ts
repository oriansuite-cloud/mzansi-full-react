import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";
import { db } from "../db/index.ts";
import * as schema from "../db/schema/auth.ts";
import { env } from "./env.ts";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	secret: env.BETTER_AUTH_SECRET,
  // Google sign-in is optional and can only attach to an existing invited user.
  // Provider secrets remain server-side. Never open public implicit registration.
  socialProviders: process.env.MZC_GOOGLE_CLIENT_ID && process.env.MZC_GOOGLE_CLIENT_SECRET
    ? { google: {
        clientId: process.env.MZC_GOOGLE_CLIENT_ID,
        clientSecret: process.env.MZC_GOOGLE_CLIENT_SECRET,
        disableSignUp: true,
        disableImplicitSignUp: true,
      } }
    : {},

	baseURL: env.BETTER_AUTH_URL,
	emailAndPassword: {
		enabled: true,
		// Operator-only initial bootstrap; public account creation is off by default.
		disableSignUp: process.env.MZC_ALLOW_SIGNUP !== "true",
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},
	plugins: [admin(), organization()],
	trustedOrigins: [env.BETTER_AUTH_URL, env.FRONTEND_URL],
});

/**
 * @public
 */
export type Auth = typeof auth;
