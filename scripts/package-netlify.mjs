import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();const target=path.join(root,'outputs/netlify-deploy');
await rm(target,{recursive:true,force:true});await mkdir(path.join(target,'netlify/functions'),{recursive:true});
await cp(path.join(root,'dist-netlify'),path.join(target,'public'),{recursive:true});
await cp(path.join(root,'netlify/functions'),path.join(target,'netlify/functions'),{recursive:true});
await writeFile(path.join(target,'netlify.toml'),`[build]\n  publish = "public"\n  functions = "netlify/functions"\n[functions]\n  node_bundler = "esbuild"\n[[redirects]]\n  from = "/api/studio"\n  to = "/.netlify/functions/studio"\n  status = 200\n  force = true\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200\n[[headers]]\n  for = "/*"\n  [headers.values]\n    X-Content-Type-Options = "nosniff"\n    Referrer-Policy = "strict-origin-when-cross-origin"\n    Permissions-Policy = "microphone=(self)"\n[[headers]]\n  for = "/assets/*"\n  [headers.values]\n    Cache-Control = "public, max-age=31536000, immutable"\n`);
console.log(target);
