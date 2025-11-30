/**
 * Middleware d'authentification pour les endpoints admin
 */

import { Context, Next } from "hono";
import { ADMIN_PASSWORD } from "../utils/const";

/**
 * Middleware pour vérifier le mot de passe admin
 */
export const adminAuth = async (c: Context, next: Next) => {
  // Si pas de mot de passe configuré, autoriser tout le monde
  if (!ADMIN_PASSWORD) {
    await next();
    return;
  }

  // Récupérer le mot de passe depuis le header Authorization
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  // Format attendu: "Bearer <password>"
  const [type, password] = authHeader.split(" ");

  if (type !== "Bearer" || !password) {
    return c.json(
      { error: "Invalid authorization format. Use: Bearer <password>" },
      401
    );
  }

  if (password !== ADMIN_PASSWORD) {
    return c.json({ error: "Invalid admin password" }, 403);
  }

  // Authentification réussie, continuer
  await next();
};
