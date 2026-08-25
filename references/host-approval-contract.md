# Host authority boundary

Workflow never grants host tool, shell, model, filesystem, network, or sandbox permission and never writes host settings. The active host and project harness decide concrete execution and approval behavior appropriate to the project.

Workflow MCP annotations describe only the Workflow call's own state effects. They are not program allowlists and do not approve anything the harness might do.

A host or harness failure blocks only the affected Workflow phase or reduces evidence grade. Ordinary Cursor and Codex use remains available. Only a healthy explicitly active repository-read-only Review may reject mutations inside that Review phase.

Changes to host configuration require separate human authorization outside Workflow Root authority.
