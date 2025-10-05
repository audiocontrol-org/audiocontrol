import { expect } from "chai";
import { parseRemoteVolumes } from "@/io/akaitools-remote.js";

describe('akaitools-remote', () => {
    describe('parseRemoteVolumes', () => {
        it('should parse empty data', () => {
            const result = parseRemoteVolumes('');
            expect(result).to.be.an('array').with.length(0);
        });

        it('should parse valid remote volume', () => {
            // Format: | ID(2-3) : LUN(6-9) : image(19+)
            // Positions: |_00_:____0_:_~/images/test.hds
            //            0123456789012345678901234567890
            const data = '| 00 :    0 : ~/images/test.hds';
            const result = parseRemoteVolumes(data);
            expect(result).to.have.length(1);
            expect(result[0].scsiId).to.equal(0);
            expect(result[0].lun).to.equal(0);
            expect(result[0].image).to.equal('~/images/test.hds');
        });

        it('should parse multiple volumes', () => {
            const data = '| 00 :    0 : ~/images/test1.hds\n| 03 :    0 : ~/images/test2.hds';
            const result = parseRemoteVolumes(data);
            expect(result).to.have.length(2);
            expect(result[0].scsiId).to.equal(0);
            expect(result[1].scsiId).to.equal(3);
        });

        it('should skip non-matching lines', () => {
            const data = 'Header line\n| 00 :    0 : ~/images/test.hds\nFooter line';
            const result = parseRemoteVolumes(data);
            expect(result).to.have.length(1);
        });

        it('should handle whitespace in image path', () => {
            const data = '| 00 :    0 : ~/images/test file.hds';
            const result = parseRemoteVolumes(data);
            expect(result[0].image).to.equal('~/images/test file.hds');
        });

        it('should parse double-digit SCSI IDs', () => {
            const data = '| 15 :    0 : ~/images/disk.hds';
            const result = parseRemoteVolumes(data);
            expect(result[0].scsiId).to.equal(15);
        });

        it('should handle different LUN values', () => {
            const data = '| 00 :    5 : ~/images/disk.hds';
            const result = parseRemoteVolumes(data);
            expect(result[0].lun).to.equal(5);
        });
    });
});
