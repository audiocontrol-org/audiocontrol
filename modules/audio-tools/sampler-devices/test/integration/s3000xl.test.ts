import {newDevice} from "@/client/client-akai-s3000xl.js";
import midi from "midi";
import {newServerOutput} from "@oletizi/sampler-lib";
import {expect} from "chai";

describe(`Test generated output.`, () => {
    it(`Compiles and does stuff.`, () => {
        const device = newDevice(new midi.Input(), new midi.Output(), newServerOutput())
        expect(device).to.exist
    })
})
