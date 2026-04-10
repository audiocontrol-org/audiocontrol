---
name: deploy-bridge
description: "Cross-compile the scsi-midi-bridge, deploy to the Pi, and verify it's running."
user_invocable: true
---

# Deploy Bridge

Deploy the SCSI MIDI bridge to the Raspberry Pi:

1. **Build and deploy**: `make deploy-scsi-bridge`
   - This stops the stock s2p service, kills existing daemons, deploys binaries, starts s2p and bridge

2. **Verify**: Check the output for "Deploy complete" and `samplerReachable: true`

3. **If deployment fails**:
   - Check SSH: `ssh orion@s3k.local 'echo ok'`
   - Check if stock s2p is blocking: `ssh orion@s3k.local 'sudo systemctl status s2p'`
   - Check bridge log: `ssh orion@s3k.local 'tail -20 /tmp/e2e-bridge.log'`

4. **Report** the bridge status to the user
