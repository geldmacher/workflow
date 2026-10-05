# Test data and isolation

Use when shared state, uncontrolled inputs or external effects make checks unreliable or unsafe. Reuse an adequate fixture system rather than introducing another service. Inspect data ownership, seeding/reset routes, ports, processes, external destinations and cleanup behavior, including failed runs.

## Control the test boundary

Use minimal representative data with explicit expected outcomes. Control time and random seeds where relevant; give concurrent runs distinct databases, directories, accounts or namespaces. Prefer isolated local/test instances for mutations and observe the actual external-effect boundary. A configuration called dry-run or test is not proof that writes or messages are suppressed.

Track resources created by this exercise and their ownership before cleanup. Make setup and cleanup repeatable; preserve pre-existing or concurrent work. Retain actions and final observations outside the disposable workspace or in an approved ignored evidence location. Avoid copying production credentials or personal data into fixtures.

Possible artifacts are seeds, fixture builders, temporary-directory helpers and cleanup instructions. For a form test, create a dedicated test submission and route delivery to the project's established test sink; assert the received message and remove only that submission and owned sink data.

## Prove and maintain

Run twice from a known state, and exercise cleanup after an intentional failure where useful. Check that another run's or a pre-existing sentinel resource survives and evidence remains accessible. Maintenance rechecks ownership assumptions, schema changes, service destinations and reset commands. Missing safe isolation limits execution; it does not authorize resetting shared state.
