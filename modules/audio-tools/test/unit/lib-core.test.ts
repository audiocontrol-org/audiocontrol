import {bytes2numberBE, bytes2numberLE, natural2real, parseNote, real2natural, scale} from "@/lib/lib-core"
import {expect} from "chai";
import {bytes2Number} from "../src-deprecated/lib/lib-akai-s56k";

describe('Core lib', () => {
    it('scale', () => {
        expect(scale(50, 0, 100, 0, 10)).eq(5)
        expect(scale(-1, -100, 100, 0, 200)).eq(99)
    })
    it('real2natural', () => {
        expect(real2natural(0, -100, 100)).eq(100)
        expect(real2natural(50, 0, 100)).eq(50)
    })
    it('natural2real', () => {
        expect(natural2real(50, 0, 100)).eq(50)
        expect(natural2real(100, -100, 100)).eq(0)
        expect(natural2real(100, -50, 100)).eq(50)
    })
    it('parses note as number', () => {
        expect(parseNote("60")).eq(60)
    })
    it('parses note as scale', () => {
        expect(parseNote('C3')).eq(60)
    })

    it('byte2number', () => {
        let b = [1, 0]
        expect(bytes2numberLE(b)).to.eq(1)
        expect(bytes2numberBE(b)).to.eq(256)
    })
})