/**
 * Validates production Excel files: parsed collection totals vs source columns.
 * Run: node scripts/validate-production-files.mjs [dir]
 */
import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST_GOLD = path.join(ROOT, "scripts", ".dist", "lib", "gold-loan", "excel-parser.js");
const DIST_MF = path.join(ROOT, "scripts", ".dist", "scripts", ".mf-excel-parser.js");

function compileParsers() {
  const { execSync } = require("child_process");
  const tsc = path.join(ROOT, "node_modules", "typescript", "lib", "tsc.js");
  const node = process.execPath;
  const mfSrc = path.join(ROOT, "lib", "mf-loan", "excel-parser.ts");
  let mfText = fs.readFileSync(mfSrc, "utf8");
  mfText = mfText
    .replace("from '@/lib/gold-loan/excel-parser'", "from '../lib/gold-loan/excel-parser'")
    .replace("from './types'", "from '../lib/mf-loan/types'");
  const mfTmp = path.join(ROOT, "scripts", ".mf-excel-parser.ts");
  fs.writeFileSync(mfTmp, mfText);
  try {
    const outDir = path.join(ROOT, "scripts", ".dist");
    fs.rmSync(outDir, { recursive: true, force: true });
    execSync(
      `"${node}" "${tsc}" --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --strict false --outDir "${outDir}" --rootDir "${ROOT}" "${path.join(ROOT, "lib", "gold-loan", "excel-parser.ts")}" "${mfTmp}" "${path.join(ROOT, "lib", "mf-loan", "types.ts")}"`,
      { stdio: "pipe", cwd: ROOT },
    );
    const mfJs = path.join(outDir, "scripts", ".mf-excel-parser.js");
    if (fs.existsSync(mfJs)) {
      let js = fs.readFileSync(mfJs, "utf8");
      js = js.replace(/require\(["']@\/lib\/gold-loan\/excel-parser["']\)/g,
        'require("../lib/gold-loan/excel-parser")');
      fs.writeFileSync(mfJs, js);
    }
  } finally {
    try {
      fs.unlinkSync(mfTmp);
    } catch {
      /* ignore */
    }
  }
}

function loadParsers() {
  if (!fs.existsSync(DIST_GOLD)) compileParsers();
  const gold = require(DIST_GOLD);
  const mf = require(DIST_MF);
  return { gold, mf };
}

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\r?\n/g, " ")
    .replace(/#/g, " number ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumnKey(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const exact = normalized.findIndex((h) => h === normAlias);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    const fuzzy = normalized.findIndex(
      (h) => h.includes(normAlias) || normAlias.includes(h),
    );
    if (fuzzy >= 0) return fuzzy;
  }
  return -1;
}

function sumRawColumn(filePath, headerAliases, headerRowIndex = 1) {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  const headers = (matrix[headerRowIndex] ?? []).map((c) => String(c ?? "").trim());
  const colIdx = findColumnKey(headers, headerAliases);
  if (colIdx < 0) return { sum: null, header: null, error: `Column not found: ${headerAliases[0]}` };

  let sum = 0;
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const v = matrix[i]?.[colIdx];
    if (v == null || v === "") continue;
    const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) sum += n;
  }
  return { sum, header: headers[colIdx], rows: matrix.length - headerRowIndex - 1 };
}

function safe(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

const FILES = {
  goldTxnApril: "TRANSACTIONS STATEMENT APRIL 26.xlsx",
  goldTxnThane: "TransactionsDuringPeriod Thane.xlsx",
  goldBalApril: "GOLD LOAN BALANCE STATEMENT APRIL 26.xlsx",
  goldBalThane: "LoanBalanceStatement during the period Thane.xlsx",
  goldBalGeneric: "LoanBalanceStatement.xlsx",
  goldInterest: "LoanInterestExtractList Thane.xlsx",
  mfBal: "GroupLoan-LoanBalanceStatement - MF.xlsx",
  mfTxn: "GroupLoan-Transactionduringperiod - MF.xlsx",
  mfClosed: "GroupLoan-ClosedloansList MF.xlsx",
};

function main() {
  const vidsDir = process.argv[2] || "e:\\VIDS";
  const { gold, mf } = loadParsers();

  console.log("\n=== Production Excel validation ===\n");
  console.log(`Directory: ${vidsDir}\n`);

  const results = [];

  // Gold transaction — collection must match Amount Received (+ Thane extra column)
  for (const [key, name] of [
    ["goldTxnApril", FILES.goldTxnApril],
    ["goldTxnThane", FILES.goldTxnThane],
  ]) {
    const fp = path.join(vidsDir, name);
    if (!fs.existsSync(fp)) {
      results.push({ key, status: "SKIP", reason: "file missing" });
      continue;
    }
    const buf = fs.readFileSync(fp);
    const parsed = gold.parseGoldLoanExcel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), name);
    const parsedSum = parsed.rows.reduce((s, r) => s + safe(r.totalAmountReceived), 0);
    const rawAmt = sumRawColumn(fp, ["Amount Received"]);
    const rawExtra = sumRawColumn(fp, ["Interest and other charges received"]);
    const rawTotal =
      rawAmt.sum != null && rawExtra.sum != null
        ? rawAmt.sum + (rawExtra.header ? rawExtra.sum : 0)
        : rawAmt.sum;

    const match =
      rawAmt.sum != null &&
      Math.abs(parsedSum - rawTotal) < 0.01;
    results.push({
      key,
      fileType: parsed.fileType,
      mappedCol: parsed.headers.find((h) => h === normalizeHeader("amount received")) ? "amount received" : "?",
      parsedSum,
      rawAmountReceived: rawAmt.sum,
      rawInterestAndOther: rawExtra.header ? rawExtra.sum : "N/A",
      rawTotal,
      match,
      rowCount: parsed.rowCount,
      errors: parsed.errors,
    });
  }

  // MF transaction — Total Rcvd
  {
    const name = FILES.mfTxn;
    const fp = path.join(vidsDir, name);
    if (fs.existsSync(fp)) {
      const buf = fs.readFileSync(fp);
      const rows = mf.parseMfLoanTransactionStatement(buf);
      const parsedSum = rows.reduce((s, r) => s + safe(r.totalReceived), 0);
      const raw = sumRawColumn(fp, ["Total Rcvd"]);
      const match = raw.sum != null && Math.abs(parsedSum - raw.sum) < 0.01;
      results.push({
        key: "mfTxn",
        parsedSum,
        rawTotalRcvd: raw.sum,
        rawHeader: raw.header,
        match,
        rowCount: rows.length,
      });
    }
  }

  // Spot-check other file types detect correctly
  for (const [key, name, expectType] of [
    ["goldBalApril", FILES.goldBalApril, "balance"],
    ["goldBalThane", FILES.goldBalThane, "balance"],
    ["goldInterest", FILES.goldInterest, "interest-extract"],
    ["mfBal", FILES.mfBal, "balance"],
  ]) {
    const fp = path.join(vidsDir, name);
    if (!fs.existsSync(fp)) continue;
    const buf = fs.readFileSync(fp);
    if (key.startsWith("mf")) {
      const det = mf.detectMfFile(name, buf);
      results.push({ key, detect: det.fileType, confidence: det.confidence, matched: det.matchedColumns?.slice(0, 6) });
    } else {
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const parsed = gold.parseGoldLoanExcel(ab, name);
      results.push({
        key,
        fileType: parsed.fileType,
        expectType,
        typeOk: parsed.fileType === expectType,
        rowCount: parsed.rowCount,
        accountCol: parsed.originalHeaders.find((h) => normalizeHeader(h).includes("account")),
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));

  const failures = results.filter((r) => r.match === false || r.typeOk === false);
  if (failures.length) {
    console.error("\nFAILED checks:", failures.length);
    process.exit(1);
  }
  const collChecks = results.filter((r) => "match" in r);
  if (collChecks.every((r) => r.match === true || r.status === "SKIP")) {
    console.log("\nAll collection column checks PASSED.");
  }
  process.exit(0);
}

main();
