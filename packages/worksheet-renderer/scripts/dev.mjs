import { context } from 'esbuild';
const ctx = await context({ entryPoints:['demo/main.ts'],outfile:'demo/bundle.js',bundle:true,format:'esm',platform:'browser',target:'es2020',sourcemap:true });
await ctx.watch();
const server=await ctx.serve({host:'127.0.0.1',port:Number(process.env.PORT||4178),servedir:'demo'});
console.log(`Worksheet preview: http://${server.host}:${server.port}`);
