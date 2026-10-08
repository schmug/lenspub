// SPDX-License-Identifier: Apache-2.0
// Minimal static host, restricted to reader assets and their pure engine imports.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../poc/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
createServer(async (req,res) => {
  const headers = {'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  try {
    const url = new URL(req.url,'http://localhost');
    if (url.pathname === '/') { res.writeHead(302,{...headers,Location:'/reader/'}); res.end(); return; }
    const pathname = url.pathname === '/reader/' ? '/reader/index.html' : url.pathname;
    if (!/^\/(reader|engine)\/[a-z0-9.-]+\.(html|js|css|svg)$/.test(pathname)) throw new Error('Not found');
    const body = await readFile(path.join(root,pathname));
    res.writeHead(200,{...headers,'Content-Type':mime[path.extname(pathname)]}); res.end(body);
  } catch { res.writeHead(404,headers); res.end('Not found'); }
}).listen(port,process.env.HOST || '127.0.0.1', () => console.log(`LensPub reading demo: http://localhost:${port}/reader/`));
