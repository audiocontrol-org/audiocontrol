#!/bin/sh
ssh pi-scsi.local /home/orion/mount.sh \
    && (cd ~/.akai-sampler && rsync -e ssh -avn --checksum ./target/. pi-scsi.local:~/stacks2/) \
    && ssh pi-scsi.local sudo /home/orion/umount.sh
