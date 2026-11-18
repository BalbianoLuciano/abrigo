import { Module, type DynamicModule } from "@nestjs/common";
import type { Env } from "../config/env.js";
import { CoreModule } from "../core.module.js";
import { Processors } from "./processors.js";

@Module({})
export class WorkerModule {
  static forRoot(env: Env): DynamicModule {
    return { module: WorkerModule, imports: [CoreModule.forRoot(env)], providers: [Processors] };
  }
}
