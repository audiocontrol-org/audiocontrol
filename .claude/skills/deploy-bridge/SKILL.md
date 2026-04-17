---
name: deploy-bridge
description: "Cross-compile the scsi-midi-bridge, deploy to the Pi, and verify it's running."
user_invocable: true
---

# Deploy Bridge

Deploy the SCSI MIDI bridge to the Raspberry Pi via the sanctioned pipeline.

## Background

`make deploy-scsi-bridge` is the sanctioned target for deploying daemons (per `.claude/rules/e2e-testing.md` decision matrix). It depends on `check-scsi-bridge`, which depends on stamp files that gate the Docker cross-compile of s2p and the Rust bridge.

**Known failure mode (worktree-specific):** the build stamps (`.docker-build-stamp` for s2p and bridge) can exist while the actual binaries (`.docker-build/s2p`, `.docker-build/scsi-midi-bridge`) do not — typically when a fresh worktree inherits stamps but not the gitignored `.docker-build/` directory. Make sees fresh stamps with no source changes and skips the rebuild, then `check-scsi-bridge` fails with "binary not found." Self-heal by removing the stale stamp and retrying.

## Steps

1. **Self-heal stale stamps.** Before running make, check that each stamp matches an actual binary; remove any stamp whose binary is missing. Run:
   ```bash
   for pair in "services/scsi-midi-bridge/.docker-build-stamp:services/scsi-midi-bridge/.docker-build/scsi-midi-bridge" \
               ".deps/scsi2pi/.docker-build-stamp:.deps/scsi2pi/.docker-build/s2p"; do
     stamp="${pair%%:*}"; bin="${pair##*:}"
     if [ -f "$stamp" ] && [ ! -f "$bin" ]; then
       echo "Stale stamp detected — removing $stamp (binary $bin missing)"
       rm -f "$stamp"
     fi
   done
   ```
   (If `.deps/scsi2pi/` doesn't exist yet on this machine, the second check is a no-op — Make will clone it.)

2. **Build and deploy:** `make deploy-scsi-bridge`
   - Cross-compiles s2p and scsi-midi-bridge for ARM64 via Docker (if needed)
   - Stops stock s2p service, kills existing daemons
   - SCPs binaries to `/tmp/s2p-midi` and `/tmp/e2e-scsi-midi-bridge`
   - Starts s2p on port 6868 and bridge on port 7033

3. **Verify:** look for `Deploy complete` and `samplerReachable: true` in the output. As a separate quick check (per TESTING-E2E.md "Quick checks"):
   ```bash
   curl http://s3k.local:7033/status
   ```

4. **If deployment fails:**
   - SSH: `ssh orion@s3k.local 'echo ok'`
   - Stock s2p blocking: `ssh orion@s3k.local 'sudo systemctl status s2p'`
   - Bridge log: `ssh orion@s3k.local 'tail -20 /tmp/e2e-bridge.log'`
   - s2p log: `ssh orion@s3k.local 'tail -20 /tmp/e2e-s2p.log'`

5. **Report** the bridge status to the user.

## When NOT to use this skill

For running e2e tests, use `modules/e2e-infra/scripts/run-and-watch.sh <make-target>` instead — the runner scripts handle full provisioning + cleanup as part of the test lifecycle. This skill is only for ad-hoc bridge deployment that needs to leave the daemons running.
