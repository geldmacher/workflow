#!/usr/bin/env node
// Repository-only fixture driver, never shipped as execution policy.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const marker = 'workflow-project-setup-fixture-v1';
export const scenarios = ['bare', 'ready', 'stale', 'regression', 'access', 'northstar-missing', 'northstar-vague', 'northstar-ready', 'northstar-conflict'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const product = "export function exportRows(rows) { return 'value\\n' + rows.map(String).join('\\n') + (rows.length ? '\\n' : ''); }\n";
const check = "import assert from 'node:assert/strict';\nimport { exportRows } from './csv.mjs';\nassert.equal(exportRows([]), 'value\\n');\nassert.equal(exportRows(['alpha']), 'value\\nalpha\\n');\nassert.equal(exportRows(['alpha','beta']), 'value\\nalpha\\nbeta\\n');\nconsole.log('export checks passed');\n";

function owned(base) {
  const root = resolve(base);
  assert.equal(lstatSync(root).isSymbolicLink(), false, 'fixture root must not be a symlink');
  assert.equal(dirname(realpathSync(root)), realpathSync(tmpdir()), 'fixture must be under the system temporary directory');
  assert.ok(basename(root).startsWith('workflow-project-setup-'), 'unexpected fixture name');
  assert.equal(readFileSync(join(root, '.owner'), 'utf8'), marker, 'fixture ownership missing');
  for (const name of ['workspace', 'evidence']) {
    if (existsSync(join(root, name))) assert.equal(lstatSync(join(root, name)).isSymbolicLink(), false, `${name} must not be a symlink`);
  }
  return root;
}

function files(root, prefix = '') {
  return Object.fromEntries(readdirSync(join(root, prefix), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const relative = join(prefix, entry.name);
    assert.ok(!entry.isSymbolicLink(), `fixture snapshot rejects symlink: ${relative}`);
    assert.ok(entry.isDirectory() || entry.isFile(), `unsupported fixture file: ${relative}`);
    return entry.isDirectory() ? Object.entries(files(root, relative)) : [[relative, readFileSync(join(root, relative), 'utf8')]];
  }));
}
const snapshot = root => Object.fromEntries(Object.entries(files(root)).map(([name,content]) => [name,hash(content)]));

export function prepareFixture(scenario) {
  assert.ok(scenarios.includes(scenario), `Use a scenario: ${scenarios.join(', ')}`);
  const base = mkdtempSync(join(tmpdir(), 'workflow-project-setup-'));
  writeFileSync(join(base, '.owner'), marker);
  const workspace = join(base, 'workspace');
  const evidence = join(base, 'evidence');
  mkdirSync(workspace); mkdirSync(evidence);
  writeFileSync(join(workspace, 'csv.mjs'), scenario === 'regression' ? product.replace('rows.map', 'rows.slice(1).map') : product);
  writeFileSync(join(workspace, 'cli.mjs'), "import { exportRows } from './csv.mjs';\nprocess.stdout.write(exportRows(process.argv.slice(2)));\n");
  writeFileSync(join(workspace, 'REQUIREMENTS.md'), '# Export requirements\n\nThe CLI emits the value header and every supplied row in order, including zero, one and multiple rows. Inputs are simple strings without commas or line breaks. Product behavior is already approved.\n');
  writeFileSync(join(workspace, 'unrelated.txt'), 'pre-existing user work: preserve byte-for-byte\n');
  writeFileSync(join(workspace, 'AGENTS.md'), '# Export project\n\nUse the supplied candidate Workflow instructions. Preserve REQUIREMENTS.md, csv.mjs, cli.mjs and unrelated.txt unless the assignment explicitly includes them. All changes belong inside this workspace. External delivery, plugin installation and host configuration are outside this assignment.\n');
  const command = scenario === 'stale' ? 'node old-check.mjs' : 'node check.mjs';
  writeFileSync(join(workspace, 'README.md'), '# CSV exporter\n\nRun `node cli.mjs alpha beta`.\n' + (scenario === 'bare' ? '\nNo repeatable check route has been established.\n' : `\nRun \`${command}\` after export changes. It checks zero, one and multiple rows.\n`) + (scenario === 'access' ? '\nRelease acceptance also requires a live vendor-service check. No vendor endpoint, credential, or fixture service is available. Local checks cover only the exporter.\n' : ''));
  if (!['northstar-missing', 'northstar-vague'].includes(scenario)) {
    const boundary = scenario === 'access'
      ? 'It runs locally, with release acceptance requiring an agreed live check that a vendor service can consume its exports.'
      : 'It is a local tool; vendor-service integration is outside its purpose.';
    writeFileSync(join(workspace, 'PROJECT.md'), `# Project direction\n\nThis exporter helps operations staff transfer complete, ordered records into existing spreadsheets. Predictability matters more than advanced formatting. ${boundary}\n`);
  } else if (scenario === 'northstar-vague') {
    writeFileSync(join(workspace, 'PROJECT.md'), '# Project direction\n\nBuild the best export experience.\n');
  }
  if (scenario === 'northstar-conflict') {
    writeFileSync(join(workspace, 'PROPOSAL.md'), '# Proposed direction\n\nReplace local operations exports with a hosted vendor analytics service for marketing teams. No decision has been recorded.\n');
  }
  if (scenario !== 'bare') writeFileSync(join(workspace, 'check.mjs'), check);
  writeFileSync(join(evidence, 'baseline.json'), JSON.stringify({ scenario, files: snapshot(workspace) }, null, 2));
  return { base, workspace, evidence, scenario };
}

export function inspectFixture(base) {
  const root = owned(base);
  const baseline = JSON.parse(readFileSync(join(root, 'evidence/baseline.json'), 'utf8'));
  const current = snapshot(join(root, 'workspace'));
  const changed = [...new Set([...Object.keys(current), ...Object.keys(baseline.files)])].filter(name => current[name] !== baseline.files[name]);
  return { base: root, scenario: baseline.scenario, files: current, changed, unrelatedPreserved: current['unrelated.txt'] === baseline.files['unrelated.txt'], productPreserved: ['csv.mjs','cli.mjs','REQUIREMENTS.md'].every(name => current[name] === baseline.files[name]) };
}

export function probeFixture(base) {
  const root = owned(base);
  const before = inspectFixture(root);
  const runs = [[], ['alpha'], ['alpha','beta']].map(args => {
    const result = spawnSync(process.execPath, [join(root, 'workspace/cli.mjs'), ...args], { encoding: 'utf8', timeout: 10000 });
    const expected = 'value\n' + args.join('\n') + (args.length ? '\n' : '');
    return { args, status: result.status, stdout: result.stdout, stderr: result.stderr, passed: result.status === 0 && result.stdout === expected };
  });
  const after = inspectFixture(root);
  const result = { runs, passed: runs.every(run => run.passed) && after.unrelatedPreserved && after.productPreserved, workspaceUnchanged: JSON.stringify(before.files) === JSON.stringify(after.files) };
  writeFileSync(join(root, 'evidence/product-probe.json'), JSON.stringify(result, null, 2));
  return result;
}

export function cleanupFixture(base) {
  const root = owned(base);
  if (existsSync(join(root, 'workspace'))) {
    let final;
    try {
      final = inspectFixture(root);
      writeFileSync(join(root, 'evidence/final-files.json'), JSON.stringify(files(join(root, 'workspace')), null, 2));
    } catch (error) { final = { error: error.message }; }
    writeFileSync(join(root, 'evidence/final-state.json'), JSON.stringify(final, null, 2));
  }
  rmSync(join(root, 'workspace'), { recursive: true, force: true });
  assert.ok(existsSync(join(root, 'evidence/baseline.json')), 'evidence must survive cleanup');
  return { evidence: join(root, 'evidence'), workspaceRemoved: !existsSync(join(root, 'workspace')) };
}

export function main(args) {
  const [action, value] = args;
  if (args.length !== 2) throw new Error('Use prepare SCENARIO | inspect BASE | probe BASE | cleanup BASE');
  if (action === 'prepare') return prepareFixture(value);
  if (action === 'inspect') return inspectFixture(value);
  if (action === 'probe') return probeFixture(value);
  if (action === 'cleanup') return cleanupFixture(value);
  throw new Error('Use prepare SCENARIO | inspect BASE | probe BASE | cleanup BASE');
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
