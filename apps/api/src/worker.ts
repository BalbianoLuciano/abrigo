import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "./config/env.js";
import { Processors } from "./worker/processors.js";
import { WorkerModule } from "./worker/worker.module.js";

const env = loadEnv();
const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(env));
app.enableShutdownHooks();
app.get(Processors).start();
