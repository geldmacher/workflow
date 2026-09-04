import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fencedBlocks(markdown) {
  return [...markdown.matchAll(/```markdown\n([\s\S]*?)\n```/g)].map((match) => match[1]);
}

function materialize(source, values) {
  let output = source;
  for (const [name, value] of Object.entries(values)) output = output.replaceAll(`{{${name}}}`, value);
  return output;
}

function command(markdown, label) {
  const marker = label + " command: `";
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `${label} command missing`);
  const valueStart = start + marker.length;
  const end = markdown.indexOf("`", valueStart);
  assert.notEqual(end, -1, `${label} command is not closed`);
  return markdown.slice(valueStart, end).split(" ");
}

function runCommand(markdown, label) {
  const [program, ...args] = command(markdown, label);
  return spawnSync(program, args, { encoding: "utf8" });
}

async function waitForDoctor(args) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = spawnSync(args[0], args.slice(1), { encoding: "utf8" });
    if (result.status === 0) return result;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return spawnSync(args[0], args.slice(1), { encoding: "utf8" });
}

test("project-verifier readiness is a closed read-only decision across targets", () => {
  const contract = read("references/verification-work-contract.md");
  const statuses = [...contract.matchAll(/^\| [1-5] \|.*\| `([a-z-]+)` \|$/gm)].map((match) => match[1]);
  assert.deepEqual(statuses, [
    "not-applicable",
    "blocked",
    "create-recommended",
    "maintenance-recommended",
    "ready",
  ]);
  assert.match(contract, /A Doctor inspection is repository-read-only/);
  assert.match(contract, /must not start an application/);
  assert.match(contract, /must not.*create Workflow artifacts/is);

  for (const path of [
    "skills/workflow-doctor/SKILL.md",
    "targets/codex/skills/workflow-doctor/SKILL.md",
    "targets/agent-plugins/skills/workflow-doctor/SKILL.md",
  ]) {
    const skill = read(path);
    assert.match(skill, /^---\nname: workflow-doctor\n/);
    for (const status of statuses) assert.match(skill, new RegExp(`\\b${status}\\b`), path);
    assert.match(skill, /do not start an application or mutate anything/i, path);
    assert.match(skill, /Create no Workflow artifact, evidence grade, authority, or runtime-success claim/i, path);
  }
});

test("verification-work preserves Root, phase, maintenance, and evidence boundaries", () => {
  const contract = read("references/verification-work-contract.md");
  for (const path of [
    "skills/verification-work/SKILL.md",
    "targets/codex/skills/verification-work/SKILL.md",
    "targets/agent-plugins/skills/verification-work/SKILL.md",
  ]) {
    const skill = read(path);
    assert.match(skill, /^---\nname: verification-work\n/);
    assert.match(skill, /`inspect` by default, `create`, `maintain`.*`maintain full`/is, path);
    assert.match(skill, /exact approved Schema-6 Root/i, path);
    assert.match(skill, /matching human implementation or correction authorization/i, path);
    assert.match(skill, /\.agents\/skills\/verify-<surface-slug>/, path);
    assert.match(skill, /Change only the verifier directory/i, path);
    assert.match(skill, /never edit an oracle to hide a product regression/i, path);
    assert.match(skill, /Return exactly `clean`, `changed`, or `blocked`/i, path);
    assert.match(skill, /Never claim `verified`/i, path);
    assert.doesNotMatch(skill, /\.cursor\/skills/);
  }
  assert.match(contract, /Evidence from before a verifier or repository snapshot change never proves the new snapshot retroactively/);
  assert.match(contract, /No action commits, pushes, opens a PR, merges, deploys, publishes, installs, accesses production, or persists Learning/);

  const authoritative = [
    "schemas/artifacts/work-plan-6.schema.json",
    "schemas/artifacts/delivery-evidence-6.schema.json",
    "schemas/artifacts/work-review-6.schema.json",
    "schemas/harness-phase-request.schema.json",
    "schemas/harness-phase-result.schema.json",
  ].map(read).join("\n");
  assert.doesNotMatch(authoritative, /workflow-doctor|verification-work|project verifier|feature map/i);
});

test("adaptive lifecycle routes verifier work without another gate or learning mutation", () => {
  for (const path of [
    "skills/work-planning/SKILL.md",
    "targets/codex/skills/plan-work/SKILL.md",
    "targets/agent-plugins/skills/plan-work/SKILL.md",
  ]) {
    const plan = read(path);
    assert.match(plan, /Verification readiness/);
    assert.match(plan, /running UI, CLI, service, side-effect boundary, or cross-surface journey/);
    assert.match(plan, /no second playbook choice or gate/i);
    assert.match(plan, /never becomes a Core extension/i);
  }
  for (const path of ["skills/work-execution/SKILL.md", "targets/agent-plugins/skills/implement-work/SKILL.md"]) {
    const implementation = read(path);
    assert.match(implementation, /approved Root explicitly covers a project verifier/i);
    assert.match(implementation, /Do not infer that scope from behavioral acceptance alone/i);
  }
  for (const path of [
    "skills/work-review/SKILL.md",
    "targets/codex/skills/review-work/SKILL.md",
    "targets/agent-plugins/skills/review-work/SKILL.md",
  ]) {
    const review = read(path);
    assert.match(review, /Never edit it during Review/i);
    assert.match(review, /Raw Drive output is an observation only/i);
  }
  for (const path of [
    "skills/work-learning/SKILL.md",
    "targets/codex/skills/learn-from-work/SKILL.md",
    "targets/agent-plugins/skills/learn-from-work/SKILL.md",
  ]) {
    const learning = read(path);
    assert.match(learning, /future `verification-work maintain` candidate/i);
    assert.match(learning, /never edited by Learning/i);
    assert.match(learning, /Run-specific observations remain evidence only/i);
  }
});

test("materialized verifier fixture drives one feature, preserves evidence, and cleans only its process", async () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-verifier-fixture-"));
  const project = join(root, "project");
  const fixture = join(project, "fixture");
  const verifier = join(project, ".agents", "skills", "verify-fixture-app");
  const features = join(verifier, "features");
  const evidenceRoot = join(root, "evidence");
  const statePath = join(root, "fixture-state.json");
  mkdirSync(fixture, { recursive: true });
  mkdirSync(features, { recursive: true });

  const serverPath = join(fixture, "server.mjs");
  const doctorPath = join(fixture, "doctor.mjs");
  const drivePath = join(fixture, "drive.mjs");
  const cleanupPath = join(fixture, "cleanup.mjs");
  writeFileSync(serverPath, `import { writeFileSync } from "node:fs";\nwriteFileSync(process.argv[2], JSON.stringify({ pid: process.pid, ready: true }));\nconst timer = setInterval(() => {}, 1000);\nprocess.on("SIGTERM", () => { clearInterval(timer); process.exit(0); });\n`);
  writeFileSync(doctorPath, `import { readFileSync } from "node:fs";\nconst state = JSON.parse(readFileSync(process.argv[2], "utf8"));\nprocess.kill(state.pid, 0);\nprocess.stdout.write("ready\\n");\n`);
  writeFileSync(drivePath, `import { mkdirSync, readFileSync, writeFileSync } from "node:fs";\nconst state = JSON.parse(readFileSync(process.argv[2], "utf8"));\nprocess.kill(state.pid, 0);\nmkdirSync(process.argv[3], { recursive: true });\nwriteFileSync(process.argv[3] + "/feature-fixture.json", JSON.stringify({ feature: "feature-fixture", observed: "passed" }));\n`);
  writeFileSync(cleanupPath, `import { readFileSync, rmSync } from "node:fs";\nconst state = JSON.parse(readFileSync(process.argv[2], "utf8"));\nprocess.kill(state.pid, "SIGTERM");\nrmSync(process.argv[2]);\n`);

  const [skillTemplate, featureTemplate] = fencedBlocks(read("references/project-verifier-template.md"));
  const values = {
    SURFACE_SLUG: "fixture-app",
    SURFACE_NAME: "Fixture App",
    DISCOVERY_SCOPE: "the fixture behavior",
    LAUNCH_COMMAND: `node ${serverPath} ${statePath}`,
    DOCTOR_COMMAND: `node ${doctorPath} ${statePath}`,
    DRIVE_COMMAND: `node ${drivePath} ${statePath} ${evidenceRoot}`,
    EVIDENCE_ROOT: evidenceRoot,
    CLEANUP_COMMAND: `node ${cleanupPath} ${statePath}`,
    ISOLATION_BOUNDARY: root,
    HELPERS: `${doctorPath}, ${drivePath}, ${cleanupPath}`,
    COVERAGE_BOUNDARY: "Only feature-fixture is covered by this isolated smoke.",
    FEATURE_ID: "feature-fixture",
    USER_GOAL: "Observe the ready fixture.",
    SETUP: "Launch the isolated fixture.",
    DRIVE_PATH: "Run the fixture drive command.",
    ORACLE: "The evidence reports passed.",
    FEATURE_EVIDENCE: join(evidenceRoot, "feature-fixture.json"),
    FEATURE_CLEANUP: "Run the captured-PID cleanup command.",
  };
  const generatedSkill = materialize(skillTemplate, values);
  const generatedFeatures = materialize(featureTemplate, values);
  writeFileSync(join(verifier, "SKILL.md"), `${generatedSkill}\n`);
  writeFileSync(join(features, "README.md"), `${generatedFeatures}\n`);

  assert.doesNotMatch(`${generatedSkill}\n${generatedFeatures}`, /\{\{[^}]+\}\}/);
  assert.match(generatedSkill, /^---\nname: verify-fixture-app\n/);
  for (const heading of ["Launch", "Doctor", "Drive", "Evidence", "Cleanup", "Isolation", "Helpers"]) {
    assert.match(generatedSkill, new RegExp(`^## ${heading}$`, "m"));
  }
  assert.equal(join(verifier, "SKILL.md").startsWith(project), true);
  assert.equal(evidenceRoot.startsWith(project), false);

  const fixtureHashes = new Map([serverPath, doctorPath, drivePath, cleanupPath].map((path) => [path, sha256(readFileSync(path))]));
  const launch = command(generatedSkill, "Launch");
  const child = spawn(launch[0], launch.slice(1), { stdio: "ignore" });
  try {
    const doctor = await waitForDoctor(command(generatedSkill, "Doctor"));
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.equal(doctor.stdout.trim(), "ready");

    const drive = runCommand(generatedSkill, "Drive");
    assert.equal(drive.status, 0, drive.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(evidenceRoot, "feature-fixture.json"), "utf8")), {
      feature: "feature-fixture",
      observed: "passed",
    });

    writeFileSync(join(features, "README.md"), `${generatedFeatures}\n\nTargeted maintenance: feature-fixture.\n`);
    const driveAfterMaintenance = runCommand(generatedSkill, "Drive");
    assert.equal(driveAfterMaintenance.status, 0, driveAfterMaintenance.stderr);
    for (const [path, hash] of fixtureHashes) assert.equal(sha256(readFileSync(path)), hash, path);

    const cleanup = runCommand(generatedSkill, "Cleanup");
    assert.equal(cleanup.status, 0, cleanup.stderr);
    assert.equal(existsSync(statePath), false);
    assert.equal(existsSync(join(evidenceRoot, "feature-fixture.json")), true);
    if (child.exitCode === null) await new Promise((resolve) => child.once("exit", resolve));
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    rmSync(root, { recursive: true, force: true });
  }
});
