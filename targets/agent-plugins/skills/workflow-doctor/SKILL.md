---
name: workflow-doctor
description: Inspect whether a repository needs or has a usable project-local behavioral verifier without changing files or starting the product.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Workflow Doctor

Read [portable Manual boundaries](../../references/portable-manual.md) and the [project verification contract](../../../../references/verification-work-contract.md) completely.

Inspect only. Determine whether current acceptance needs a running UI, CLI, service, side-effect boundary, or cross-surface journey beyond established checks. Inspect relevant product surfaces, harness documentation, tests, ignored evidence conventions, and `.agents/skills/verify-*`; do not start an application or mutate anything.

Apply the contract's precedence and return exactly one status: `ready`, `create-recommended`, `maintenance-recommended`, `not-applicable`, or `blocked`. Name the concrete cause, inspected evidence, impact, and one suggested follow-up. Create no Workflow artifact, evidence grade, authority, or runtime-success claim.
