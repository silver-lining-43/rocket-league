import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  try { const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname)); if(!file.startsWith(root+sep)){res.writeHead(403).end();return;} const content=await readFile(file); res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(content); }
  catch {res.writeHead(404).end('Not found');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
