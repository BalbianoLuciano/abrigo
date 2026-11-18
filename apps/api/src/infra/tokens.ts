/** Tokens de inyección. Usamos @Inject explícito en todos lados (sin depender de metadata). */
export const ENV = Symbol("ENV");
export const DB = Symbol("DB");
export const DB_HANDLE = Symbol("DB_HANDLE");
export const REDIS = Symbol("REDIS");
export const AUTH = Symbol("AUTH");
export const KEY_RING = Symbol("KEY_RING");
export const QUEUES = Symbol("QUEUES");
export const REALTIME = Symbol("REALTIME");
export const MAILER = Symbol("MAILER");
export const WEB_PUSH = Symbol("WEB_PUSH");
