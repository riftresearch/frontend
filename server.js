// server.js - Custom Next.js server for standalone deployment
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/**
 * Check if origin is allowed
 * Allows: *.rift.trade and localhost:*
 */
function isOriginAllowed(origin) {
  if (!origin) return false;

  // Allow *.rift.trade (including rift.trade itself)
  if (
    origin.endsWith(".rift.trade") ||
    origin === "https://rift.trade" ||
    origin === "http://rift.trade"
  ) {
    return true;
  }

  // Allow localhost on any port
  if (origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
    return true;
  }

  // Allow 127.0.0.1 on any port
  if (origin.match(/^https?:\/\/127\.0\.0\.1(:\d+)?$/)) {
    return true;
  }

  return false;
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Add CORS headers to all responses
      addCorsHeaders(req, res);

      // Handle preflight OPTIONS requests
      if (req.method === "OPTIONS") {
        res.statusCode = 200;
        res.end();
        return;
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  })
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(
        `> Server listening at http://${hostname}:${port} as ${
          dev ? "development" : process.env.NODE_ENV
        }`
      );
    });
});
