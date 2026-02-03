import * as easymidi from "easymidi"
import {newServerOutput} from "@audiocontrol/sampler-lib";
import { describe, it, expect } from 'vitest';
import {newDevice} from "@/client/client-akai-s3000xl.js";

describe(`Akai S3000xl MIDI Device`, () => {
    it('Creates MIDI device client', () => {
        const device = newDevice(new easymidi.Input('test', true), new easymidi.Output('test', true), newServerOutput())
        expect(device).toBeDefined()
    })
})
