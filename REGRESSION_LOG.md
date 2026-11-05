# Regression log

One line per real incident or revert: what the bug was, which layer should have caught it, and the systematic fix. The only metric the review workflow keeps — costs nothing in quiet periods.

Universal incidents (vibe-CLI facts, relevant to every repo using this pipeline) are pre-seeded below; number your repo's own incidents from 003.

| # | Date | Incident | Should have been caught by | Systematic fix |
|---|------|----------|---------------------------|----------------|
| 001 | (seeded) | `vibe -p --auto-approve` bypasses the read_file denylist in a fenced VIBE_HOME (vibe 3.0.2) — fenced agent could read the key env file and /etc/hostname with the flag set | Layer 3 (security pass — the reviewer flagged auto-approve; the bypass mechanism was confirmed only by runner-side live testing) | Never use --auto-approve on fenced headless agents; denied reads fail instantly without it, so the flag is unnecessary |
| 002 | (seeded) | Fence allowlist `/tmp/pr*` silently denied everything in subdirectories — vibe 3.0.2 globs do not cross `/`; multiple review rounds can run with unreadable criteria before the mechanism is found | Layer 1 (agent self-check: live-test the reviewer's actual read path, not just the runner shell's) | Allowlist enumerates depth levels x8; glob semantics documented in fence config; preflight assertion fails the job loudly if criteria are unreadable |
