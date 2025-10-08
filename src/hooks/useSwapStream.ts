import { useEffect, useState } from "react";

const ANALYTICS_API_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_API_URL || "http://localhost:3000";

interface SwapStreamResult {
  latestSwap: any | null;
  isConnected: boolean;
  error: string | null;
}

/**
 * Hook to connect to Server-Sent Events (SSE) stream for real-time swap updates
 * Uses fetch with ReadableStream to support Authorization headers
 */
export function useSwapStream(): SwapStreamResult {
  const [latestSwap, setLatestSwap] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    // Get API key from cookie
    const getApiKeyFromCookie = (): string => {
      if (typeof document === "undefined") return "";

      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === "admin_api_key") {
          return value;
        }
      }
      return "";
    };

    async function connectToStream() {
      const apiKey = getApiKeyFromCookie();
      if (!apiKey) {
        console.warn("No API key found for swap stream");
        setError("No API key found");
        return;
      }

      try {
        console.log("Connecting to swap stream...");
        const response = await fetch(`${ANALYTICS_API_URL}/api/swaps/stream`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Stream connection failed: ${response.status}`,
            errorText
          );
          throw new Error(`Failed to connect: ${response.status}`);
        }

        console.log("🔗 Connected to swap stream");
        setIsConnected(true);
        setError(null);

        if (!response.body) {
          throw new Error("No response body");
        }

        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!isCancelled) {
          try {
            const { done, value } = await reader.read();

            if (done) {
              console.log("Stream ended by server");
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");

            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === "connected") {
                    console.log("✅ Stream initialized");
                    continue;
                  }

                  // New swap received!
                  console.log("🆕 New swap received:", data.id);
                  setLatestSwap(data);
                } catch (parseError) {
                  console.error(
                    "Error parsing SSE data:",
                    parseError,
                    "Line:",
                    line
                  );
                }
              }
            }
          } catch (readError) {
            if (!isCancelled) {
              console.error("Error reading stream:", readError);
              break;
            }
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Stream error:", err);
          setError("Connection lost");
          setIsConnected(false);
        }
      }
    }

    connectToStream();

    return () => {
      isCancelled = true;
      if (reader) {
        reader.cancel().catch(() => {});
      }
      setIsConnected(false);
      console.log("Swap stream connection closed");
    };
  }, []);

  return { latestSwap, isConnected, error };
}
