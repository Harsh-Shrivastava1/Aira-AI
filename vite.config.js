import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

/**
 * Local API Serverless Middleware Plugin
 * 
 * Routes local /api/* requests directly to api/*.js serverless function handlers
 * during local development, matching Vercel's production serverless behavior.
 */
function localApiPlugin(env) {
  return {
    name: 'local-api-serverless-middleware',
    configureServer(server) {
      // Ensure all environment variables from .env are available in process.env
      Object.assign(process.env, env);

      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = urlObj.pathname;

        if (pathname.startsWith('/api/')) {
          const route = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
          const filePath = path.resolve(__dirname, 'api', `${route}.js`);

          if (fs.existsSync(filePath)) {
            try {
              // Parse body for JSON / Text requests (skip multipart for Busboy streaming)
              if (req.headers['content-type']?.includes('application/json')) {
                const chunks = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                const raw = Buffer.concat(chunks).toString('utf-8');
                req.body = raw ? JSON.parse(raw) : {};
              } else if (!req.headers['content-type']?.includes('multipart/form-data')) {
                const chunks = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                const raw = Buffer.concat(chunks).toString('utf-8');
                try {
                  req.body = raw ? JSON.parse(raw) : {};
                } catch {
                  req.body = raw;
                }
              }

              // Query params
              req.query = Object.fromEntries(urlObj.searchParams.entries());

              // Vercel / Express response helper methods
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };
              res.send = (data) => {
                res.end(data);
                return res;
              };

              // Dynamically import and execute the API handler
              const module = await server.ssrLoadModule(filePath);
              const handler = module.default || module;
              await handler(req, res);
              return;
            } catch (err) {
              console.error(`[Local API Error] ${pathname}:`, err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
              }
              return;
            }
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), localApiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
