/**
 * Convierte en admin a una cuenta ya registrada (vía /v1/helpers/register).
 * Uso: DATABASE_URL=... node dist/cli/promote-admin.js persona@ejemplo.com
 * Queda en la auditoría.
 */
import { auditLog, authUsers, createDb, eq } from "@abrigo/db";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.DATABASE_URL;
if (!email || !url) {
  console.error("Uso: DATABASE_URL=... node dist/cli/promote-admin.js <email>");
  process.exit(1);
}

const handle = createDb(url, { max: 1 });
try {
  const [user] = await handle.db
    .update(authUsers)
    .set({ role: "admin" })
    .where(eq(authUsers.email, email))
    .returning({ id: authUsers.id, twoFactorEnabled: authUsers.twoFactorEnabled });
  if (!user) {
    console.error("No existe una cuenta con ese email. Registrala primero.");
    process.exitCode = 1;
  } else {
    await handle.db.insert(auditLog).values({
      actorType: "system",
      action: "admin.promoted",
      targetType: "user",
      targetId: user.id,
      metadata: { via: "cli" },
    });
    console.log(
      user.twoFactorEnabled
        ? "Listo: la cuenta ahora es admin."
        : "Listo: la cuenta ahora es admin. Al ingresar se le va a pedir activar TOTP.",
    );
  }
} finally {
  await handle.close();
}
