/**
 * One-shot PRIVATE owner bootstrap. Do not expose a public sign-up endpoint.
 * Run in a disposable API container with MZC_ALLOW_SIGNUP=true for this process.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, openSync, writeSync, closeSync, chmodSync } from "node:fs";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth.ts";
import { closeDatabase, db } from "../db/index.ts";
import { user } from "../db/schema/auth.ts";

const output = process.env.MZC_OWNER_CREDENTIALS_FILE || "/app/uploads/owner-first-login.txt";
const email = process.env.MZC_OWNER_EMAIL || "operator@localhost.test";

async function main() {
  if (process.env.MZC_ALLOW_SIGNUP !== "true") {
    throw new Error("Bootstrap requires a one-shot process explicitly enabling account creation");
  }
  if (!/^[a-z0-9_.+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    throw new Error("Invalid owner email");
  }
  const existing = await db.select({ id: user.id }).from(user).limit(1);
  if (existing.length > 0) throw new Error("Refusing bootstrap: users already exist");

  const password = "MzC!" + randomBytes(27).toString("base64url");
  const created = await auth.api.signUpEmail({
    body: { name: "MzansiCloud Platform Owner", email, password },
  });
  if (!created?.user?.id) throw new Error("Better Auth did not create the owner");
  await db.update(user).set({ role: "admin" }).where(eq(user.id, created.user.id));
  mkdirSync("/app/uploads", { recursive: true, mode: 0o700 });
  const fd = openSync(output, "wx", 0o600);
  try {
    writeSync(fd, [
      "MzansiCloud private first-owner credentials",
      "Username/email: " + email,
      "One-time password: " + password,
      "Login via SSH tunnel: http://127.0.0.1:8788/login",
      "Change the email and password after first successful login.",
      "Never publish this file or commit it to Git.",
    ].join("\n") + "\n");
  } finally {
    closeSync(fd);
    chmodSync(output, 0o600);
  }
  console.log("OWNER_BOOTSTRAP_CREATED");
  console.log("OWNER_EMAIL=" + email);
  console.log("CREDENTIALS_FILE_CREATED (password not printed)");
}

main().catch((err: unknown) => {
  console.error("OWNER_BOOTSTRAP_FAILED:", err instanceof Error ? err.message : "unknown error");
  process.exitCode = 1;
}).finally(async () => {
  await closeDatabase();
});
