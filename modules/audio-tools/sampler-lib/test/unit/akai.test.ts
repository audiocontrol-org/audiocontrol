import { describe, it } from 'mocha';
import { expect } from 'chai';
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
            expect(AkaiRecordType.NULL).to.equal('NULL');
            expect(AkaiRecordType.PARTITION).to.equal('S3000 PARTITION');
            expect(AkaiRecordType.VOLUME).to.equal('S3000 VOLUME');
            expect(AkaiRecordType.PROGRAM).to.equal('S3000 PROGRAM');
            expect(AkaiRecordType.SAMPLE).to.equal('S3000 SAMPLE');
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
            expect(record.type).to.equal(AkaiRecordType.SAMPLE);
            expect(record.name).to.equal('Test Sample');
            expect(record.block).to.equal(100);
            expect(record.size).to.equal(1024);
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
            expect(volume.records).to.be.an('array');
            expect(volume.records).to.have.length(1);
            expect(volume.records[0].name).to.equal('Sample 1');
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
            expect(partition.volumes).to.be.an('array');
            expect(partition.volumes).to.have.length(1);
            expect(partition.volumes[0].name).to.equal('Volume 1');
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
            expect(disk.timestamp).to.be.a('number');
            expect(disk.name).to.equal('Test Disk');
            expect(disk.partitions).to.be.an('array');
            expect(disk.partitions).to.have.length(1);
        });
    });

    describe('RemoteDisk interface', () => {
        it('should accept scsiId and image path', () => {
            const remoteDisk: RemoteDisk = {
                scsiId: 3,
                image: '/path/to/image.hda'
            };
            expect(remoteDisk.scsiId).to.equal(3);
            expect(remoteDisk.image).to.equal('/path/to/image.hda');
        });

        it('should accept optional lun parameter', () => {
            const remoteDiskWithLun: RemoteDisk = {
                scsiId: 3,
                lun: 0,
                image: '/path/to/image.hda'
            };
            expect(remoteDiskWithLun.lun).to.equal(0);
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
            expect(config.diskFile).to.equal('/path/to/disk.hda');
            expect(config.akaiToolsPath).to.equal('/usr/local/bin/akaitools');
            expect(config.piscsiHost).to.equal('192.168.1.100');
            expect(config.scsiId).to.equal(3);
        });
    });
});
