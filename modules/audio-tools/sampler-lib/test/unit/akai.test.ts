import { describe, it, expect } from 'vitest';
import {
    AkaiRecordType,
    AkaiRecord,
    AkaiVolume,
    AkaiPartition,
    AkaiDisk,
    RemoteDisk
} from '@/model/akai';

describe('Akai Model Types', () => {
    describe('AkaiRecordType enum', () => {
        it('should have correct values', () => {
            expect(AkaiRecordType.NULL).toBe('NULL');
            expect(AkaiRecordType.PARTITION).toBe('S3000 PARTITION');
            expect(AkaiRecordType.VOLUME).toBe('S3000 VOLUME');
            expect(AkaiRecordType.PROGRAM).toBe('S3000 PROGRAM');
            expect(AkaiRecordType.SAMPLE).toBe('S3000 SAMPLE');
        });
    });

    describe('AkaiRecord interface', () => {
        it('should accept valid record data', () => {
            const record: AkaiRecord = {
                type: AkaiRecordType.SAMPLE,
                name: 'Test Sample',
                block: 100,
                size: 1024
            };
            expect(record.type).toBe(AkaiRecordType.SAMPLE);
            expect(record.name).toBe('Test Sample');
            expect(record.block).toBe(100);
            expect(record.size).toBe(1024);
        });
    });

    describe('AkaiVolume interface', () => {
        it('should extend AkaiRecord with records array', () => {
            const volume: AkaiVolume = {
                type: AkaiRecordType.VOLUME,
                name: 'Test Volume',
                block: 0,
                size: 2048,
                records: [
                    {
                        type: AkaiRecordType.SAMPLE,
                        name: 'Sample 1',
                        block: 100,
                        size: 512
                    }
                ]
            };
            expect(volume.records).toBeInstanceOf(Array);
            expect(volume.records).toHaveLength(1);
            expect(volume.records[0].name).toBe('Sample 1');
        });
    });

    describe('AkaiPartition interface', () => {
        it('should extend AkaiRecord with volumes array', () => {
            const partition: AkaiPartition = {
                type: AkaiRecordType.PARTITION,
                name: 'Test Partition',
                block: 0,
                size: 4096,
                volumes: [
                    {
                        type: AkaiRecordType.VOLUME,
                        name: 'Volume 1',
                        block: 100,
                        size: 2048,
                        records: []
                    }
                ]
            };
            expect(partition.volumes).toBeInstanceOf(Array);
            expect(partition.volumes).toHaveLength(1);
            expect(partition.volumes[0].name).toBe('Volume 1');
        });
    });

    describe('AkaiDisk interface', () => {
        it('should contain timestamp, name, and partitions', () => {
            const disk: AkaiDisk = {
                timestamp: Date.now(),
                name: 'Test Disk',
                partitions: [
                    {
                        type: AkaiRecordType.PARTITION,
                        name: 'Partition 1',
                        block: 0,
                        size: 8192,
                        volumes: []
                    }
                ]
            };
            expect(typeof disk.timestamp).toBe('number');
            expect(disk.name).toBe('Test Disk');
            expect(disk.partitions).toBeInstanceOf(Array);
            expect(disk.partitions).toHaveLength(1);
        });
    });

    describe('RemoteDisk interface', () => {
        it('should accept scsiId and image path', () => {
            const remoteDisk: RemoteDisk = {
                scsiId: 3,
                image: '/path/to/image.hda'
            };
            expect(remoteDisk.scsiId).toBe(3);
            expect(remoteDisk.image).toBe('/path/to/image.hda');
        });

        it('should accept optional lun parameter', () => {
            const remoteDiskWithLun: RemoteDisk = {
                scsiId: 3,
                lun: 0,
                image: '/path/to/image.hda'
            };
            expect(remoteDiskWithLun.lun).toBe(0);
        });
    });

    describe('AkaiToolsConfig interface', () => {
        it('should accept required and optional properties', () => {
            const config = {
                diskFile: '/path/to/disk.hda',
                akaiToolsPath: '/usr/local/bin/akaitools',
                piscsiHost: '192.168.1.100',
                scsiId: 3
            };
            expect(config.diskFile).toBe('/path/to/disk.hda');
            expect(config.akaiToolsPath).toBe('/usr/local/bin/akaitools');
            expect(config.piscsiHost).toBe('192.168.1.100');
            expect(config.scsiId).toBe(3);
        });
    });
});
