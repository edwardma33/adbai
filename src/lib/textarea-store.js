/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const Database = require("better-sqlite3");
const { eq } = require("drizzle-orm");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { integer, sqliteTable, text } = require("drizzle-orm/sqlite-core");

const databaseDirectory = process.env.VERCEL
  ? path.join(os.tmpdir(), "adbai")
  : path.join(process.cwd(), "data");
const databasePath = path.join(databaseDirectory, "textarea.db");

fs.mkdirSync(databaseDirectory, { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS textarea_document (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO textarea_document (id, content, updated_at)
  VALUES (1, '', 0);
`);

const textareaDocument = sqliteTable("textarea_document", {
  id: integer("id").primaryKey(),
  content: text("content").notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

const db = drizzle(sqlite);

function readTextareaDocument() {
  const row = db.select().from(textareaDocument).where(eq(textareaDocument.id, 1)).get();

  if (row) {
    return row;
  }

  return {
    id: 1,
    content: "",
    updatedAt: 0,
  };
}

function writeTextareaDocument(content) {
  const updatedAt = Date.now();

  db.insert(textareaDocument)
    .values({
      id: 1,
      content,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: textareaDocument.id,
      set: {
        content,
        updatedAt,
      },
    })
    .run();

  return {
    id: 1,
    content,
    updatedAt,
  };
}

let liveTextareaDocument = readTextareaDocument();

function getTextareaDocument() {
  return liveTextareaDocument;
}

function getPersistedTextareaDocument() {
  return readTextareaDocument();
}

function setTextareaDocumentContent(content) {
  liveTextareaDocument = {
    ...liveTextareaDocument,
    content,
    updatedAt: Date.now(),
  };

  return liveTextareaDocument;
}

function saveTextareaDocument(content) {
  liveTextareaDocument = writeTextareaDocument(content);
  return liveTextareaDocument;
}

module.exports = {
  db,
  getTextareaDocument,
  getPersistedTextareaDocument,
  saveTextareaDocument,
  setTextareaDocumentContent,
  textareaDocument,
};
