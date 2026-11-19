import {defineConfig} from 'vite';
import fs from 'node:fs';
export default defineConfig({base:'./',server:{host:'0.0.0.0',port:5173,https:process.env.HTTPS==='1'?{key:fs.readFileSync('certs/key.pem'),cert:fs.readFileSync('certs/cert.pem')}:undefined},build:{chunkSizeWarningLimit:1500}});
