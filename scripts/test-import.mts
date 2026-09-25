// 노션 가져오기 파서 확인용: npx tsx scripts/test-import.mts
import { readFileSync } from "node:fs";
import { parseCsvFiles, readFiles, suggestCategory } from "../src/lib/notionImport.ts";

const buf = readFileSync(new URL("./fixtures/notion.zip", import.meta.url));
const file = { name: "notion.zip", arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) } as unknown as File;

const csvs = await readFiles([file]);
const { rows, skipped } = parseCsvFiles(csvs);
console.table(rows.map((r) => ({ date: r.date, type: r.type, source: r.source, cat: suggestCategory(r.type, r.source, r.title), title: r.title, amount: r.amount, account: r.account, memo: r.memo, guessed: r.guessedDate })));
console.log("skipped", skipped);
