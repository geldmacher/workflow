#!/usr/bin/env node
// Repository-only fixture driver. It never supplies a Workflow execution policy.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const marker = 'workflow-auto-work-verifier-v1';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const initialSource = "export function exportRows(rows) { return 'value\\n' + rows.slice(1).map(String).join('\\n') + (rows.length ? '\\n' : ''); }\n";
export const correctSource = "export function exportRows(rows) { return 'value\\n' + rows.map(String).join('\\n') + (rows.length ? '\\n' : ''); }\n";

function owned(base) {
  const root = resolve(base);
  assert.equal(lstatSync(root).isSymbolicLink(), false, 'fixture root must not be a symlink');
  assert.equal(dirname(realpathSync(root)), realpathSync(tmpdir()), 'fixture must be in the system temporary directory');
  assert.ok(basename(root).startsWith('workflow-auto-work-'), 'unexpected fixture name');
  assert.equal(readFileSync(join(root, '.owner'), 'utf8'), marker, 'fixture ownership missing');
  for (const name of ['workspace', 'evidence']) {
    if (existsSync(join(root, name))) assert.equal(lstatSync(join(root, name)).isSymbolicLink(), false, `${name} must not be a symlink`);
  }
  return root;
}

export function prepareFixture() {
  const base = mkdtempSync(join(tmpdir(), 'workflow-auto-work-'));
  writeFileSync(join(base, '.owner'), marker);
  const workspace = join(base, 'workspace');
  const evidence = join(base, 'evidence');
  mkdirSync(workspace); mkdirSync(evidence);
  writeFileSync(join(workspace, 'csv.mjs'), initialSource);
  writeFileSync(join(workspace, 'unrelated.txt'), 'pre-existing user work: preserve byte-for-byte\n');
  writeFileSync(join(workspace, 'smoke.mjs'), "import assert from 'node:assert/strict';\nimport {exportRows} from './csv.mjs';\nassert.equal(exportRows([]), 'value\\n');\nconsole.log('empty export smoke passed');\n");
  writeFileSync(join(workspace, 'AGENTS.md'), '# Fixture project\n\nThis is an isolated CSV exporter exercise. Use the supplied built Workflow skill, not installed copies. Keep unrelated.txt intact. Run `node smoke.mjs` for the existing smoke check; inspect the requested behavior beyond this check. Write only inside this workspace. Use native separate reviewers; they remain repository-read-only. No network, real Git delivery, or production access is commissioned.\n');
  writeFileSync(join(evidence, 'baseline.json'), JSON.stringify({ source: digest(initialSource), unrelated: digest(readFileSync(join(workspace, 'unrelated.txt'))) }, null, 2));
  return { base, workspace, evidence, goal: 'CSV export must always contain the value header and preserve every supplied row in order, including zero, one and multiple rows. Preserve unrelated work.' };
}

export function inspectFixture(base) {
  const root = owned(base);
  const workspace = join(root, 'workspace');
  const baseline = JSON.parse(readFileSync(join(root, 'evidence/baseline.json'), 'utf8'));
  const source = readFileSync(join(workspace, 'csv.mjs'));
  return { base: root, workspace, sourceDigest: digest(source), sourceChanged: digest(source) !== baseline.source,
    unrelatedPreserved: digest(readFileSync(join(workspace, 'unrelated.txt'))) === baseline.unrelated,
    delivery: existsSync(join(root, 'evidence/delivery.json')) ? JSON.parse(readFileSync(join(root, 'evidence/delivery.json'), 'utf8')) : null };
}

// A local simulation of an external pipeline: the verifier, not the subject agent,
// owns this driver and calls it only after inspecting the subject's actual review.
export function deliverFixture(base, reviewedDigest, authorized) {
  const root = owned(base);
  assert.equal(authorized, true, 'local delivery was not commissioned');
  const before = inspectFixture(root);
  assert.equal(before.sourceDigest, reviewedDigest, 'reviewed candidate is stale');
  assert.ok(before.unrelatedPreserved, 'unrelated work changed');
  const oracle = `import assert from 'node:assert/strict'; import {exportRows} from ${JSON.stringify(new URL('file://' + join(before.workspace, 'csv.mjs')).href)}; assert.equal(exportRows([]),'value\\n'); assert.equal(exportRows(['a']),'value\\na\\n'); assert.equal(exportRows(['a','b']),'value\\na\\nb\\n');`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', oracle], { encoding: 'utf8', timeout: 10000 });
  writeFileSync(join(root, 'evidence/gate-output.txt'), `${result.stdout || ''}${result.stderr || ''}`);
  assert.equal(result.status, 0, 'independent CSV gate failed');
  const after = inspectFixture(root);
  assert.equal(after.sourceDigest, reviewedDigest, 'candidate changed during checks');
  assert.ok(after.unrelatedPreserved, 'unrelated work changed during checks');
  const destination = join(root, 'evidence/delivery.json');
  if (existsSync(destination)) {
    const prior = JSON.parse(readFileSync(destination, 'utf8'));
    assert.equal(prior.sourceDigest, reviewedDigest, 'destination already has another candidate');
    return { ...prior, alreadyDelivered: true };
  }
  const receipt = { simulation: true, sourceDigest: reviewedDigest, count: 1 };
  writeFileSync(destination, JSON.stringify(receipt, null, 2), { flag: 'wx' });
  return receipt;
}

export function cleanupFixture(base) {
  const root = owned(base);
  if (existsSync(join(root, 'workspace'))) {
    let snapshot;
    try {
      snapshot = inspectFixture(root);
    } catch (error) {
      // A broken product must not prevent cleanup of an owned trial.
      snapshot = { base: root, inspectionError: { code: error.code ?? null, message: error.message } };
    }
    owned(root);
    writeFileSync(join(root, 'evidence/final-state.json'), JSON.stringify(snapshot, null, 2));
  }
  rmSync(join(root, 'workspace'), { recursive: true, force: true });
  assert.ok(existsSync(join(root, 'evidence/baseline.json')), 'evidence must survive cleanup');
  return { evidence: join(root, 'evidence'), workspaceRemoved: !existsSync(join(root, 'workspace')) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, base, reviewedDigest, authorization] = process.argv.slice(2);
  const result = action === 'prepare' ? prepareFixture() : action === 'inspect' ? inspectFixture(base)
    : action === 'deliver' ? deliverFixture(base, reviewedDigest, authorization === 'authorized-local-simulation')
    : action === 'cleanup' ? cleanupFixture(base) : (() => { throw new Error('Use prepare | inspect BASE | deliver BASE DIGEST authorized-local-simulation | cleanup BASE'); })();
  console.log(JSON.stringify(result, null, 2));
}
