import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { pool, testConnection } from "./db";

const app = express();
app.set('trust proxy', 1);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

setupAuth(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Skip logging expected 404s for consultation-report (not yet created)
      if (res.statusCode === 404 && path.includes("/consultation-report")) {
        return;
      }
      
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Health check endpoint - must be before other routes
app.get('/health', async (_req, res) => {
  try {
    const dbHealthy = await testConnection(1, 0);
    if (dbHealthy) {
      res.status(200).json({ 
        status: 'healthy', 
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    res.status(503).json({ 
      status: 'unhealthy', 
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // On Windows, use localhost instead of 0.0.0.0 to avoid ENOTSUP error
  // On production (Linux), use 0.0.0.0 for external access
  const host = process.platform === 'win32' ? 'localhost' : '0.0.0.0';
  
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });

  // Graceful shutdown for the HTTP server
  let isShuttingDown = false;
  
  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    log(`\n[Server] Received ${signal}, starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        console.error('[Server] Error during server shutdown:', err);
      } else {
        log('[Server] HTTP server closed');
      }
      
      // Database pool will be closed by db.ts handlers
      // Give it a moment to finish
      setTimeout(() => {
        process.exit(err ? 1 : 0);
      }, 1000);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
