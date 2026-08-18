import mongoose, { ClientSession, Model } from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

/** Mongoose does not re-export the driver's option type under its own name. */
type TransactionOptions = NonNullable<Parameters<ClientSession["withTransaction"]>[1]>;

/**
 * Transactions need a replica set (or a sharded cluster). MongoDB Atlas — even
 * the free M0 tier — is always a 3-node replica set, so production gets real
 * multi-document ACID for free. A bare `mongod` (the old standalone Docker
 * container) cannot do it at all.
 *
 * Detected once at connect time rather than guessed from the URI, because a
 * connection string says nothing reliable about the topology behind it.
 */
let transactionsSupported = false;

/** True once the connected deployment was confirmed to support transactions. */
export function supportsTransactions(): boolean {
  return transactionsSupported;
}

/**
 * Money-safety defaults. `majority` on both ends means a checkout that returns
 * success has been acknowledged by a majority of Atlas nodes and cannot be
 * rolled back by a failover, and that a transaction never reads data which
 * might still be rolled back.
 */
const TRANSACTION_OPTIONS: TransactionOptions = {
  readConcern: { level: "majority" },
  writeConcern: { w: "majority" },
  readPreference: "primary",
};

async function detectTransactionSupport(): Promise<boolean> {
  try {
    const admin = mongoose.connection.db?.admin();
    if (!admin) return false;
    const info = (await admin.command({ hello: 1 })) as { setName?: string; msg?: string };
    // `setName` => replica set member. `msg: "isdbgrid"` => mongos (sharded).
    return Boolean(info.setName) || info.msg === "isdbgrid";
  } catch (err) {
    logger.warn({ err }, "Không xác định được topology MongoDB, coi như không hỗ trợ transaction");
    return false;
  }
}

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

  await mongoose.connect(env.mongodbUri, {
    appName: "lylaglass-api",
    // Atlas M0 allows 500 connections cluster-wide; a small pool leaves room for
    // the Atlas UI, migrations and a second app instance.
    maxPoolSize: env.mongo.maxPoolSize,
    minPoolSize: 0,
    serverSelectionTimeoutMS: env.mongo.serverSelectionTimeoutMs,
    socketTimeoutMS: env.mongo.socketTimeoutMs,
    retryWrites: true,
    retryReads: true,
    // Index builds are managed explicitly by ensureCriticalIndexes() so a
    // production boot never races model registration against index creation.
    autoIndex: false,
  });

  transactionsSupported = await detectTransactionSupport();

  if (transactionsSupported) {
    logger.info("MongoDB hỗ trợ transaction (replica set) — checkout & thanh toán chạy ACID");
    return;
  }

  const message =
    "MongoDB hiện tại KHÔNG hỗ trợ transaction (standalone). " +
    "Checkout và thanh toán sẽ chạy ở chế độ compensating (bù trừ) thay vì ACID. " +
    "Dùng MongoDB Atlas hoặc replica set cho môi trường production.";

  // Handling money without atomicity is not a warning-level problem in production.
  if (env.isProduction && env.mongo.requireTransactions) throw new Error(message);
  logger.warn(message);
}

/**
 * Creates the indexes the application depends on for *correctness*, not just
 * speed — several of them are the mechanism that makes an operation idempotent:
 *
 *  - `Payment.idempotencyKey` unique  → one payment per order, ever
 *  - `Payment.paymentCode` unique     → a transfer memo resolves to one payment
 *  - `Payment.transactionId` unique   → a bank transaction settles one payment
 *  - `BankTransaction (provider, providerTransactionId)` unique → replayed
 *    webhooks are rejected by the database, not by a read-then-write check
 *
 * With `autoIndex` disabled these would silently never exist, so this runs at
 * boot and fails fast if it cannot complete.
 */
export async function ensureCriticalIndexes(): Promise<void> {
  const models = Object.values(mongoose.models);
  const started = Date.now();

  for (const model of models) {
    await dropSupersededTextIndex(model);
    await model.createIndexes();
  }

  logger.info({ models: models.length, ms: Date.now() - started }, "MongoDB indexes ensured");
}

/** The text-index fields a schema declares, sorted; empty when it declares none. */
function declaredTextFields(model: Model<unknown>): string[] {
  const declared = model.schema.indexes().find(([fields]) => Object.values(fields).includes("text"));
  if (!declared) return [];
  return Object.keys(declared[0])
    .filter((field) => declared[0][field] === "text")
    .sort();
}

/**
 * MongoDB allows at most **one text index per collection** and rejects a second
 * one even under a different name (`IndexOptionsConflict`, code 85). So when the
 * searchable fields of a schema change — Product's text index moved from
 * `description` to `shortDescription` — the index already in the database is not
 * merely stale: it permanently blocks the new one, and because
 * `ensureCriticalIndexes()` fails fast, every boot dies with it.
 *
 * Dropping the old index is therefore the only migration path, and it is a safe
 * one: a text index enforces no constraint and stores no data of its own, so the
 * `createIndexes()` call right after this rebuilds it from the current schema.
 * Search is unavailable only for the seconds the rebuild takes.
 *
 * Indexes whose fields already match are left untouched, which keeps this a
 * no-op on every boot after the first.
 */
async function dropSupersededTextIndex(model: Model<unknown>): Promise<void> {
  const wanted = declaredTextFields(model);
  if (wanted.length === 0) return;

  let indexes: { name?: string; key?: Record<string, unknown>; weights?: Record<string, number> }[];
  try {
    indexes = await model.collection.indexes();
  } catch (err) {
    // NamespaceNotFound (26): the collection does not exist yet, so nothing can
    // conflict — createIndexes() will create it along with the index.
    if ((err as { code?: number }).code === 26) return;
    throw err;
  }

  // A text index is stored with the synthetic key `{ _fts: "text", _ftsx: 1 }`;
  // the indexed fields appear in `weights` instead.
  const existing = indexes.find((index) => index.key?._fts === "text");
  if (!existing?.name) return;

  const current = Object.keys(existing.weights ?? {}).sort();
  if (current.length === wanted.length && current.every((field, i) => field === wanted[i])) return;

  await model.collection.dropIndex(existing.name);
  logger.info(
    { collection: model.collection.collectionName, dropped: existing.name, from: current, to: wanted },
    "Đã xoá text index cũ không khớp schema để tạo lại (MongoDB chỉ cho phép 1 text index / collection)"
  );
}

/**
 * Runs `fn` inside a multi-document transaction when the deployment supports
 * one, and directly otherwise.
 *
 * `session.withTransaction` retries the whole callback automatically on
 * `TransientTransactionError` (write conflicts between concurrent checkouts for
 * the same SKU) and on `UnknownTransactionCommitResult` (a commit whose outcome
 * was lost to a network blip), which is exactly the behaviour a checkout wants.
 *
 * **The callback must be idempotent** — it can run more than once. It must also
 * stay free of external side effects (emails, HTTP calls): those belong after a
 * successful commit, because a retried or aborted transaction would repeat or
 * orphan them.
 */
export async function withTransaction<T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (!transactionsSupported) {
    // Degraded mode (local standalone dev only — production refuses to boot
    // here). The compensating rollback paths in the services are what keep
    // this safe, and they run in both modes.
    return fn(undefined);
  }

  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    }, TRANSACTION_OPTIONS);
    // Assigned by the callback, which withTransaction always runs at least once
    // before resolving; a thrown error propagates instead of reaching here.
    return result!;
  } finally {
    await session.endSession();
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
