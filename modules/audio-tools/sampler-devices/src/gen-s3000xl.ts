import {
    genClass,
    genImports,
    genInterface,
    genParser,
    genSetters,
    readSpecs
} from "@/gen/gen-s3000xl-device.js";
import fs from "fs";
import path from "path";

const out = fs.createWriteStream(path.join('src', 'devices', 's3000xl.ts'))
const specFile = 'src/gen/akai-s3000xl.spec.yaml'

doIt().catch((e) => console.error(e))

async function doIt() {
    const def: any = await readSpecs(specFile)
    const specs = def['specs']

    out.write(genImports())
    for (const spec of specs) {
        out.write(await genInterface(spec))
        out.write('\n\n')
        out.write(await genParser(spec))
        out.write('\n\n')
        out.write(await genSetters(spec))
        out.write('\n\n')
    }
}
