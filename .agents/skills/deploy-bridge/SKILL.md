---
name: deploy-bridge
description: Build, deploy, and verify the SCSI MIDI bridge on the target Pi, then report the resulting status.
---

# Deploy Bridge

Use this when the user explicitly wants bridge deployment.

## Workflow

1. Run `make deploy-scsi-bridge`.
2. Verify the deploy result and confirm bridge health.
3. If needed, inspect:
   - `curl http://s3k.local:7033/status`
   - `ssh orion@s3k.local 'tail -20 /tmp/e2e-bridge.log'`
4. Report whether deployment succeeded and what still needs attention.
