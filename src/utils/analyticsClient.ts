export type AnalyticsPagination = {
  total: number;
  limit: number;
  offset: number;
};

export type AnalyticsSwapsResponse<TSwap = any> = {
  swaps: TSwap[];
  pagination: AnalyticsPagination;
};

const DEFAULT_API_URL = "http://localhost:3000";

export const ANALYTICS_API_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_API_URL || DEFAULT_API_URL;

/**
 * Get admin API key from cookies
 */
function getApiKeyFromCookie(): string {
  if (typeof document === "undefined") {
    return process.env.NEXT_PUBLIC_ANALYTICS_API_KEY || "";
  }

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "admin_api_key") {
      return value;
    }
  }

  // Fallback to env var if cookie not found
  return process.env.NEXT_PUBLIC_ANALYTICS_API_KEY || "";
}

export async function getSwaps(
  page: number = 0,
  pageSize: number = 10,
  filter?: "all" | "completed" | "in-progress"
): Promise<AnalyticsSwapsResponse> {
  try {
    const offset = page * pageSize;
    let url = `${ANALYTICS_API_URL}/api/swaps?limit=${pageSize}&offset=${offset}`;

    // Add filter parameter if specified
    if (filter && filter !== "all") {
      url += `&status=${filter === "completed" ? "settled" : "in_progress"}`;
    }

    const apiKey = getApiKeyFromCookie();

    console.log("url", url);
    console.log(
      "API Key from cookie:",
      apiKey ? "***" + apiKey.slice(-4) : "NOT SET"
    );

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    console.log("response", response);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response body:", errorText);

      // Dynamic import to avoid circular dependency
      const { toastError } = await import("./toast");

      if (response.status === 401) {
        toastError(null, {
          title: "Authentication Failed",
          description: "Your session may have expired. Please log in again.",
        });
      } else if (response.status === 404) {
        toastError(null, {
          title: "Analytics Server Error",
          description: "Swaps endpoint not found. Please contact support.",
        });
      } else {
        toastError(null, {
          title: "Failed to Fetch Swaps",
          description: `Server returned ${response.status}. Please try again.`,
        });
      }

      throw new Error(
        `Failed to fetch swaps: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    // console.log("Swaps data received:", JSON.stringify(data, null, 2));

    return data;
  } catch (error: any) {
    // Handle network errors
    if (error.message && !error.message.includes("Failed to fetch swaps")) {
      const { toastError } = await import("./toast");
      toastError(null, {
        title: "Network Error",
        description:
          "Could not connect to analytics server. Please check your connection.",
      });
    }

    throw error;
  }
}
