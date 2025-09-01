import {genInterface, genParser, readSpecs} from "@/gen/gen-s3000xl-device";
import {expect} from "chai";

describe('device-gen', () => {
    it('parses spec', async () => {
        const file = 'src-deprecated/gen/akai-s3000xl.spec.yaml'
        const def: any = await readSpecs(file)
        // console.log(JSON.stringify(def, null, 2))
        expect(def).exist
        const specs = def['specs']
        expect(specs).exist
        expect(specs.length).gte(1)
        const iface = await genInterface(specs[0])
        console.log(iface)

        const parser = await genParser(specs[0])
        console.log(parser)
    })
})