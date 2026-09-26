import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {readdir} from 'node:fs/promises';
const root=process.cwd();const target=path.join(root,'outputs/netlify-deploy');
await rm(target,{recursive:true,force:true});await mkdir(path.join(target,'netlify/functions'),{recursive:true});
await cp(path.join(root,'dist-netlify'),path.join(target,'public'),{recursive:true});
for(const name of await readdir(path.join(root,'netlify/functions'))){if(!name.endsWith('.mjs'))continue;await build({entryPoints:[path.join(root,'netlify/functions',name)],outfile:path.join(target,'netlify/functions',name),bundle:true,platform:'node',format:'esm',target:'node22',banner:{js:"import {createRequire as __cr} from 'node:module';const require=__cr(import.meta.url);"}});}
await writeFile(path.join(target,'netlify.toml'),`[build]\n  publish = "public"\n  functions = "netlify/functions"\n[functions]\n  node_bundler = "esbuild"\n[[redirects]]\n  from = "/api/instagram"\n  to = "/.netlify/functions/instagram"\n  status = 200\n  force = true\n[[redirects]]\n  from = "/api/media"\n  to = "/.netlify/functions/media"\n  status = 200\n  force = true\n[[redirects]]\n  from = "/api/chat"\n  to = "/.netlify/functions/chat"\n  status = 200\n  force = true\n[[redirects]]\n  from = "/api/studio"\n  to = "/.netlify/functions/studio"\n  status = 200\n  force = true\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200\n[[headers]]\n  for = "/*"\n  [headers.values]\n    X-Content-Type-Options = "nosniff"\n    Referrer-Policy = "strict-origin-when-cross-origin"\n    Permissions-Policy = "microphone=(self)"\n[[headers]]\n  for = "/assets/*"\n  [headers.values]\n    Cache-Control = "public, max-age=31536000, immutable"\n`);
console.log(target);
