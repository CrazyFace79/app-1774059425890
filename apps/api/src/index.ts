import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig(process.env);
const { app } = await buildApp(config);
await app.listen({ port: config.port, host: config.host });
console.log(`AI Look Studio API en http://${config.host}:${config.port}`);
