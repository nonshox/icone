import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "lib/i18n/locales");
const locales = ["uz", "ru", "en"];
const sets = {};
for (const locale of locales) {
  const source = fs.readFileSync(path.join(dir, `${locale}.ts`), "utf8");
  sets[locale] = new Set(
    [...source.matchAll(/"([A-Za-z0-9_.:-]+)"\s*:/g)].map((match) => match[1]),
  );
}

const base = [...(sets.uz ?? [])].sort();
if (base.length === 0) {
  console.error("dictionary parity: no keys parsed");
  process.exit(1);
}

let failed = false;
for (const locale of locales) {
  const set = sets[locale] ?? new Set();
  const missing = base.filter((key) => !set.has(key));
  const extra = [...set].filter((key) => !(sets.uz ?? new Set()).has(key)).sort();
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${locale}: ${missing.length} missing, ${extra.length} extra`);
    if (missing.length) console.error(`  missing: ${missing.join(", ")}`);
    if (extra.length) console.error(`  extra: ${extra.join(", ")}`);
  }
}
if (!failed) console.log(`dictionary parity: ok (${base.length} keys)`);
process.exit(failed ? 1 : 0);
