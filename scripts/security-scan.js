/* Runs a DeepSec Shield scan over the repo and reports only what is new.
 *
 * DeepSec: https://github.com/Unclecheng-li/DeepSec  (Shield = code audit)
 *
 * Why a wrapper rather than `deepsec shield scan .` directly:
 *
 *  - DeepSec's own --ignore-file keys rules to absolute paths, which would
 *    only work on the machine that wrote it. This normalises every finding to
 *    a repo-relative path first, so the baseline is portable.
 *  - The scanner reports a code pattern, not an exploit. Most of ours are
 *    hardcoded template strings in the shell and footer builders, with no
 *    dynamic data anywhere near them. Left unfiltered they drown out anything
 *    genuinely new, which is the usual way a scanner stops being read.
 *
 * A finding is fingerprinted by rule + relative path + evidence, deliberately
 * NOT by line number, so unrelated edits above it don't resurface it.
 *
 *   node scripts/security-scan.js            report new findings
 *   node scripts/security-scan.js --all      list every finding, baselined or not
 *   node scripts/security-scan.js --accept   fold current findings into the baseline
 *
 * Exits 1 when something new appears, so it can gate a commit or CI step.
 *
 * L3 (the layer that uploads source to an LLM) is never enabled here: the
 * scan runs with DeepSec's default --no-remote-l3. This is a client site.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(__dirname, 'security-baseline.json');
/* Outside the repo: written inside it, the scanner picks up its own report
   on the next run and reports the evidence strings back as findings. */
const TMP = path.join(os.tmpdir(), 'deepsec-report-baidayi.json');

const MODE = process.argv.includes('--accept') ? 'accept'
  : process.argv.includes('--all') ? 'all' : 'new';

/* Installed outside the repo so the tool is not vendored into the client's
   site. Override with DEEPSEC_BIN if it lives elsewhere. */
const CANDIDATES = [
  process.env.DEEPSEC_BIN,
  'C:/Users/USER/tools/DeepSec/.venv/Scripts/deepsec.exe',
  path.join(process.env.HOME || '', 'tools/DeepSec/.venv/bin/deepsec'),
  'deepsec',
].filter(Boolean);

function findBinary() {
  for (const c of CANDIDATES) {
    try {
      execFileSync(c, ['--help'], { stdio: 'ignore' });
      return c;
    } catch (e) { /* try the next one */ }
  }
  return null;
}

const bin = findBinary();
if (!bin) {
  console.error('DeepSec not found. Install it, or set DEEPSEC_BIN to the executable.');
  console.error('  git clone https://github.com/Unclecheng-li/DeepSec');
  console.error('  cd DeepSec && python -m venv .venv && ./.venv/Scripts/python -m pip install -e .');
  process.exit(2);
}

/* Run from ROOT with a relative path: passing the absolute path through
   execFileSync fails on this machine, where it contains CJK characters.
   DeepSec also exits non-zero whenever it has findings — normal for a SAST
   tool — so the report file, not the exit code, is what says it worked. */
try {
  execFileSync(bin, ['shield', 'scan', '.', '--format', 'json', '-o', TMP], { cwd: ROOT, stdio: 'ignore' });
} catch (e) {
  if (!fs.existsSync(TMP)) {
    console.error('Scan failed: ' + e.message);
    process.exit(2);
  }
}

const report = JSON.parse(fs.readFileSync(TMP, 'utf8'));
fs.unlinkSync(TMP);

/* The baseline records each finding's evidence, so the scanner reads its own
   bookkeeping back as fresh findings. Skip it. */
const SELF = ['scripts/security-baseline.json'];

const findings = (report.findings || []).map(f => {
  const rel = path.relative(ROOT, f.target).split(path.sep).join('/');
  return {
    key: [f.detection_rule, rel, (f.evidence || '').trim()].join(' :: '),
    rule: f.detection_rule,
    severity: f.severity,
    file: rel,
    line: f.line,
    evidence: (f.evidence || '').trim().slice(0, 88),
  };
}).filter(f => !SELF.includes(f.file));

let baseline = { accepted: [] };
if (fs.existsSync(BASELINE)) baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const accepted = new Set((baseline.accepted || []).map(a => a.key));

if (MODE === 'accept') {
  const merged = findings.map(f => {
    const prior = (baseline.accepted || []).find(a => a.key === f.key);
    return { key: f.key, file: f.file, rule: f.rule, note: prior ? prior.note : 'TODO: why is this safe?' };
  });
  fs.writeFileSync(BASELINE, JSON.stringify({ accepted: merged }, null, 2) + '\n');
  console.log(`Baseline now holds ${merged.length} accepted finding(s). Fill in any "TODO" notes.`);
  process.exit(0);
}

const fresh = findings.filter(f => !accepted.has(f.key));
const show = MODE === 'all' ? findings : fresh;

console.log(`DeepSec Shield — ${findings.length} finding(s), ${accepted.size} baselined, ${fresh.length} new\n`);

if (!show.length) {
  console.log('No new findings.');
  process.exit(0);
}

for (const f of show) {
  const flag = accepted.has(f.key) ? '   ' : 'NEW';
  console.log(`${flag} ${f.severity.padEnd(6)} ${f.file}:${f.line}`);
  console.log(`    ${f.rule}`);
  console.log(`    ${f.evidence}`);
}

if (fresh.length) {
  console.log(`\n${fresh.length} new finding(s). Review each, then either fix it or run --accept with a note.`);
  process.exit(1);
}
process.exit(0);
