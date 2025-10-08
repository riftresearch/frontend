const ANALYTICS_API_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_API_URL || "http://localhost:3000";

const ADMIN_PASSWORD_COOKIE = "admin_api_key";

export type AuthVerificationResult = {
  success: boolean;
  error?: "NETWORK_ERROR" | "SERVER_ERROR" | "INVALID_PASSWORD";
  message?: string;
};

/**
 * Verify admin password with the backend analytics server
 */
export async function verifyAdminPassword(
  password: string
): Promise<AuthVerificationResult> {
  try {
    const response = await fetch(`${ANALYTICS_API_URL}/api/auth/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${password}`,
      },
    });

    if (response.status === 404) {
      return {
        success: false,
        error: "SERVER_ERROR",
        message: "Analytics server endpoint not found",
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: "INVALID_PASSWORD",
        message: "Invalid password",
      };
    }

    const data = await response.json();
    if (data.success === true) {
      return { success: true };
    }

    return {
      success: false,
      error: "INVALID_PASSWORD",
      message: "Invalid password",
    };
  } catch (error) {
    console.error("Auth error:", error);
    return {
      success: false,
      error: "NETWORK_ERROR",
      message: "Could not connect to analytics server",
    };
  }
}

/**
 * Store admin password in cookies
 */
export function setAdminPasswordCookie(password: string): void {
  if (typeof document === "undefined") return;

  // Set cookie with 7 day expiry, secure, httpOnly flags
  const maxAge = 60 * 60 * 24 * 7; // 7 days in seconds
  document.cookie = `${ADMIN_PASSWORD_COOKIE}=${password}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

/**
 * Get admin password from cookies
 */
export function getAdminPasswordFromCookie(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === ADMIN_PASSWORD_COOKIE) {
      return value;
    }
  }
  return null;
}

/**
 * Remove admin password from cookies (logout)
 */
export function clearAdminPasswordCookie(): void {
  if (typeof document === "undefined") return;

  document.cookie = `${ADMIN_PASSWORD_COOKIE}=; path=/; max-age=0`;
}
