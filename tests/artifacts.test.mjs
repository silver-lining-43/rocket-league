import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('all three distribution HTML files contain exactly the same current build',async()=>{const [root,docs,dist]=await Promise.all(['index.html','docs/index.html','dist/index.html'].map(load));assert.equal(root,docs);assert.equal(root,dist);assert(root.length>300000);});
test('standalone HTML embeds its runtime, styles and assets without external imports',async()=>{const html=await load('index.html');assert(!/<script[^>]+src\s*=|<link[^>]+rel=["']stylesheet|@import\s|<img[^>]+src=["']https?:/i.test(html));assert(!/type=["']module["']/.test(html));const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);new Script(scripts[0][1]);assert(html.includes('cannon'));assert(html.includes('THREE'));});
test('editable game sources do not fetch runtime resources',async()=>{for(const file of ['main','visuals','physics','ai','audio','ui','camera','input','match']){const code=await load('src/'+file+'.js');assert(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bimport\s*\(/.test(code),file+' requests a resource');}});
