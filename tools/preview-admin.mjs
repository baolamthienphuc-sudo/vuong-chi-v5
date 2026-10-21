import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as auth from '../functions/api/admin/auth.js';
import * as manage from '../functions/api/admin/manage.js';
import * as publish from '../functions/api/admin/publish.js';
import { createTestDatabase } from '../tests/d1-fixture.mjs';
import * as password from '../functions/api/admin/password.js';
import * as publicProjects from '../functions/api/projects.js';
import * as media from '../functions/api/media/[id].js';

// Local QA only. Posts and deletes exist solely in memory until this server stops.
const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ADMIN_PASSWORD: 'preview-only-password', CMS_DB: createTestDatabase() };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const port = 4173;
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const method = req.method;
      const request = new Request(url, { method, headers: req.headers,
        body: ['GET', 'HEAD'].includes(method) ? undefined : Buffer.concat(chunks) });
      const handlers = url.pathname === '/api/projects' ? publicProjects : url.pathname.startsWith('/api/media/') ? media : { auth, manage, publish, password }[url.pathname.split('/').at(-1)];
      const handler = handlers?.[`onRequest${method[0]}${method.slice(1).toLowerCase()}`] || handlers?.onRequest;
      const response = handler ? await handler({ request, env, params: { id: url.pathname.split('/').at(-1) } }) : new Response('Not found', { status: 404 });
      const headers = Object.fromEntries(response.headers);
      if (response.headers.has('set-cookie')) headers['set-cookie'] = response.headers.getSetCookie();
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let localPath = decodeURIComponent(url.pathname);
    if (localPath === '/admin' || localPath === '/admin/') localPath = '/admin/index.html';
    if (localPath === '/') localPath = '/index.html';
    const file = path.resolve(root, '.' + localPath);
    if (!file.startsWith(root) || localPath.includes('/.')) throw new Error('Forbidden');
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local QA: http://127.0.0.1:${port}/admin/ (in-memory content only)`));
