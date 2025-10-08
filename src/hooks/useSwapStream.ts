import { useEffect, useState, useRef } from "react";

const ANALYTICS_API_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_API_URL || "http://localhost:3000";

interface SwapWebSocketResult {
  latestSwap: any | null;
  updatedSwap: any | null;
  totalSwaps: number;
  inProgressSwaps: number;
  uniqueUsers: number;
  isConnected: boolean;
  error: string | null;
}

/**
 * Hook to connect to WebSocket for real-time swap updates
 * Much more reliable than SSE!
 */
export function useSwapStream(): SwapWebSocketResult {
  const [latestSwap, setLatestSwap] = useState<any | null>(null);
  const [updatedSwap, setUpdatedSwap] = useState<any | null>(null);
  const [totalSwaps, setTotalSwaps] = useState<number>(0);
  const [inProgressSwaps, setInProgressSwaps] = useState<number>(0);
  const [uniqueUsers, setUniqueUsers] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldConnectRef = useRef(true);
  const newSwapQueueRef = useRef<any[]>([]);
  const updateSwapQueueRef = useRef<any[]>([]);
  const processingNewRef = useRef(false);
  const processingUpdateRef = useRef(false);

  useEffect(() => {
    shouldConnectRef.current = true;

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

    // Process queued NEW swaps one at a time with delay
    async function processNewSwapQueue() {
      if (processingNewRef.current || newSwapQueueRef.current.length === 0) {
        return;
      }

      processingNewRef.current = true;

      while (newSwapQueueRef.current.length > 0) {
        const swap = newSwapQueueRef.current.shift();
        if (swap) {
          setLatestSwap({ ...swap, _timestamp: Date.now() }); // Force unique reference
          await new Promise((resolve) => setTimeout(resolve, 150)); // 150ms delay between swaps
        }
      }

      processingNewRef.current = false;
    }

    // Process queued UPDATED swaps one at a time with delay
    async function processUpdateQueue() {
      if (
        processingUpdateRef.current ||
        updateSwapQueueRef.current.length === 0
      ) {
        return;
      }

      processingUpdateRef.current = true;

      while (updateSwapQueueRef.current.length > 0) {
        const swap = updateSwapQueueRef.current.shift();
        if (swap) {
          setUpdatedSwap({ ...swap, _timestamp: Date.now() }); // Force unique reference
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay for updates
        }
      }

      processingUpdateRef.current = false;
    }

    function connect() {
      if (!shouldConnectRef.current) return;

      const apiKey = getApiKeyFromCookie();
      if (!apiKey) {
        console.warn("No API key found for swap WebSocket");
        setError("No API key found");
        return;
      }

      try {
        // Replace http with ws, add auth as query param
        const wsUrl =
          ANALYTICS_API_URL.replace("http://", "ws://").replace(
            "https://",
            "wss://"
          ) + `/api/swaps/ws?auth=${encodeURIComponent(apiKey)}`;

        console.log("🔗 Connecting to WebSocket:");

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("✅ WebSocket connected");
          setIsConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log(
              "📨 RAW WebSocket message:",
              JSON.stringify(message, null, 2)
            );
            console.log(
              "📊 total_swaps field:",
              message.total_swaps,
              typeof message.total_swaps
            );

            switch (message.type) {
              case "connected":
                console.log(
                  "👋 Connected:",
                  message.message || "Connected to swap stream"
                );
                if (typeof message.total_swaps === "number") {
                  console.log(
                    "✅ Setting initial total swaps:",
                    message.total_swaps
                  );
                  setTotalSwaps(message.total_swaps);
                } else {
                  console.warn("⚠️ No total_swaps in connected message");
                }
                if (typeof message.in_progress_swaps === "number") {
                  console.log(
                    "✅ Setting initial in-progress swaps:",
                    message.in_progress_swaps
                  );
                  setInProgressSwaps(message.in_progress_swaps);
                } else {
                  console.warn("⚠️ No in_progress_swaps in connected message");
                }
                if (typeof message.unique_users === "number") {
                  console.log(
                    "✅ Setting initial unique users:",
                    message.unique_users
                  );
                  setUniqueUsers(message.unique_users);
                }
                break;

              case "swap_created":
              case "swap":
                // New swap was created
                const newSwapData = message.data || message;
                console.log("🆕 New swap queued:", newSwapData.id);
                newSwapQueueRef.current.push(newSwapData);
                processNewSwapQueue();

                if (typeof message.total_swaps === "number") {
                  console.log(
                    "✅ Updating total swaps to:",
                    message.total_swaps
                  );
                  setTotalSwaps(message.total_swaps);
                } else {
                  console.warn("⚠️ No total_swaps in swap_created message");
                }
                if (typeof message.in_progress_swaps === "number") {
                  setInProgressSwaps(message.in_progress_swaps);
                }
                if (typeof message.unique_users === "number") {
                  setUniqueUsers(message.unique_users);
                }
                break;

              case "swap_updated":
                // Existing swap was updated (status/stage changed)
                console.log("🔄 Swap update queued:", message.data?.id);
                updateSwapQueueRef.current.push(message.data);
                processUpdateQueue();

                if (typeof message.in_progress_swaps === "number") {
                  setInProgressSwaps(message.in_progress_swaps);
                }
                if (typeof message.unique_users === "number") {
                  setUniqueUsers(message.unique_users);
                }
                break;

              default:
                // Handle plain swap object (not wrapped in {type, data})
                if (message.id) {
                  console.log("🆕 New swap queued (plain):", message.id);
                  newSwapQueueRef.current.push(message);
                  processNewSwapQueue();
                } else {
                  console.log("Unknown message type:", message.type);
                }
            }
          } catch (err) {
            console.error("Error parsing WebSocket message:", err);
          }
        };

        ws.onerror = (err) => {
          console.error("❌ WebSocket error:", err);
          setError("Connection error");
        };

        ws.onclose = (event) => {
          console.log("🔌 WebSocket disconnected", event.code, event.reason);
          setIsConnected(false);

          // Auto-reconnect after 3 seconds if not intentionally closed
          if (shouldConnectRef.current && event.code !== 1000) {
            console.log("Reconnecting in 3 seconds...");
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, 3000);
          }
        };
      } catch (err) {
        console.error("Failed to create WebSocket:", err);
        setError("Failed to connect");
      }
    }

    connect();

    return () => {
      shouldConnectRef.current = false;
      processingNewRef.current = false;
      processingUpdateRef.current = false;
      newSwapQueueRef.current = [];
      updateSwapQueueRef.current = [];

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }

      setIsConnected(false);
      console.log("WebSocket cleanup complete");
    };
  }, []);

  return {
    latestSwap,
    updatedSwap,
    totalSwaps,
    inProgressSwaps,
    uniqueUsers,
    isConnected,
    error,
  };
}
