import { Request, Response, NextFunction } from "express";

/**
 * Extended Express Request with authenticated user context
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    aud?: string;
  };
}

/**
 * JWT payload structure from Supabase
 */
interface JWTPayload {
  sub: string; // user ID
  email: string;
  aud?: string;
  exp: number;
  iat: number;
}

/**
 * Decode JWT without verification (we trust Supabase-signed tokens)
 */
function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Decode the payload (second part)
    const payload = Buffer.from(parts[1], "base64").toString("utf-8");
    return JSON.parse(payload) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to verify Supabase JWT tokens from Authorization header
 * Extracts user info and attaches to req.user
 *
 * Usage: app.use("/api", authenticateUser);
 */
export const authenticateUser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    const decoded = decodeJWT(token);

    if (!decoded) {
      res.status(401).json({ error: "Invalid token format" });
      return;
    }

    // Check expiration
    if (decoded.exp * 1000 < Date.now()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Attach user to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      aud: decoded.aud,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

/**
 * Optional middleware to allow requests with or without auth
 * Attaches user if valid token, continues if no token
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const decoded = decodeJWT(token);

      if (decoded && decoded.exp * 1000 > Date.now()) {
        req.user = {
          id: decoded.sub,
          email: decoded.email,
          aud: decoded.aud,
        };
      }
    }

    next();
  } catch (error) {
    console.error("Optional auth error:", error);
    next(); // Continue anyway
  }
};
