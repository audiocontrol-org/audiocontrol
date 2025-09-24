import fs from "fs/promises"
import path from "path"

const dirs = ['build', path.join('build', 'site')]
for (const dir of dirs) {
    try {
        await fs.mkdir(dir)
    } catch (err) {
        //
    }
}

const copy = [
    {
        from: path.join('src', 'html', 'index.html'),
        to: path.join('build', 'site', 'index.html'),
    },
    {
        from: path.join('src', 'html', 's56k.html'),
        to: path.join('build', 'site', 's56k.html')
    }
]


copy.forEach((spec) => {fs.cp(spec.from, spec.to).then(() => { console.log(`Copied ${spec.from} to ${spec.to}`)})})
