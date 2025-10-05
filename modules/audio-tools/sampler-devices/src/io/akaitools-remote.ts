import path from "pathe";
import { AkaiToolsConfig, RemoteDisk, RemoteVolumeResult } from "@/index.js";
import { ExecutionResult } from '@/io/akaitools-core.js';
import { doSpawn } from '@/io/akaitools-process.js';

/**
 * Parse remote volumes output from scsictl
 * @param data Raw output from scsictl -l command
 * @returns Array of remote disks with SCSI ID and image path
 */
export function parseRemoteVolumes(data: string): RemoteDisk[] {
    const rv: RemoteDisk[] = [];
    data.split('\n').forEach(i => {
        const match = i.match(/\|\s*(\d+).*/);
        if (match) {
            rv.push({
                scsiId: Number.parseInt(i.substring(2, 4).trim()),
                lun: Number.parseInt(i.substring(7, 12).trim()),
                image: i.substring(14).trim()
            });
        }
    });
    return rv;
}

/**
 * List remote volumes on PiSCSI
 * @param c Configuration with piscsiHost
 * @returns Promise resolving to list of remote volumes
 */
export async function remoteVolumes(c: AkaiToolsConfig): Promise<RemoteVolumeResult> {
    const rv: RemoteVolumeResult = { data: [], errors: [] };
    if (!c.piscsiHost) {
        rv.errors.push(new Error('Piscsi host is not defined.'));
    } else {
        await doSpawn('ssh', [c.piscsiHost, '"scsictl -l"'], {
            onData: data => {
                rv.data = rv.data.concat(parseRemoteVolumes(String(data)));
            },
            onStart: () => {
                // No action needed on start
            }
        });
    }
    return rv;
}

/**
 * Unmount a remote volume on PiSCSI
 * @param c Configuration with piscsiHost
 * @param v Remote disk to unmount
 * @returns Promise resolving to execution result
 */
export async function remoteUnmount(c: AkaiToolsConfig, v: RemoteDisk): Promise<ExecutionResult> {
    const rv: ExecutionResult = { code: -1, errors: [] };
    if (!c.piscsiHost) {
        rv.errors.push(new Error('Piscsi host is not defined.'));
    } else {
        const result = await doSpawn('ssh', [c.piscsiHost, `"scsictl -c d -i ${v.scsiId}"`]);
        rv.code = result.code;
        rv.errors = rv.errors.concat(result.errors);
    }
    return rv;
}

/**
 * Mount a remote volume on PiSCSI
 * @param c Configuration with piscsiHost
 * @param v Remote disk to mount
 * @returns Promise resolving to execution result
 */
export async function remoteMount(c: AkaiToolsConfig, v: RemoteDisk): Promise<ExecutionResult> {
    const rv: ExecutionResult = { code: -1, errors: [] };
    if (!c.piscsiHost) {
        rv.errors.push(new Error('Piscsi host is not defined'));
    } else {
        const result = await doSpawn('ssh', [c.piscsiHost, `"scsictl -c a -i ${v.scsiId} -f ${v.image}"`]);
        rv.code = result.code;
        rv.errors = rv.errors.concat(result.errors);
    }
    return rv;
}

/**
 * Synchronize local disk image to remote PiSCSI and mount it
 * @param c Configuration with piscsiHost, scsiId, and diskFile
 * @returns Promise resolving to execution result
 */
export async function remoteSync(c: AkaiToolsConfig): Promise<ExecutionResult> {
    const rv: ExecutionResult = { code: -1, errors: [] };
    if (!c.piscsiHost || c.scsiId === undefined) {
        rv.errors.push(new Error('Remote host not defined.'));
        return rv;
    }

    console.log(`Listing remote volumes...`);
    const result = await remoteVolumes(c);
    rv.errors = rv.errors.concat(result.errors);
    if (result.errors.length !== 0) {
        return rv;
    }

    let targetVolume: RemoteDisk | undefined;
    for (const v of result.data) {
        if (v.scsiId === c.scsiId) {
            targetVolume = v;
            break;
        }
    }

    const parsedPath = path.parse(c.diskFile);
    const imagePath = `"~/images/${parsedPath.name}${parsedPath.ext}"`;

    if (targetVolume) {
        const r = await remoteUnmount(c, targetVolume);
        if (r.errors.length !== 0) {
            rv.errors = rv.errors.concat(r.errors);
            return rv;
        }
    }
    targetVolume = { image: imagePath, scsiId: c.scsiId };

    const syncResult = await doSpawn('scp', [`"${c.diskFile}"`, `${c.piscsiHost}:${targetVolume.image}`]);
    if (syncResult.errors.length !== 0) {
        rv.errors = rv.errors.concat(syncResult.errors);
    }

    const mountResult = await remoteMount(c, targetVolume);
    if (mountResult.errors.length !== 0) {
        rv.errors = rv.errors.concat(mountResult.errors);
        return rv;
    }

    rv.code = rv.errors.length;
    return rv;
}
