import fs from "fs/promises";
import {Entry, DirList} from "./api.ts"
import path from "path";
import {translate} from "@/lib/lib-translate-s56k";
import {newProgramFromBuffer} from "@/lib/lib-akai-s56k";
import * as Path from "path";


export function makeBreadCrumb(root: string, leaf: string) {
    return leaf.substring(root.length, leaf.length)
}

function exclude(entry: string) {
    return entry.startsWith('.') || entry.startsWith('$') || entry.startsWith('#')
}

export class Brain {
    private readonly sourceRoot: string;
    private source: string;
    private readonly targetRoot: string
    private target: string;

    constructor(home: string, target: string) {
        console.log(`home: ${home}, target: ${target}`)
        this.sourceRoot = path.resolve(home)
        this.source = this.sourceRoot
        this.targetRoot = path.resolve(target)
        this.target = this.targetRoot
    }

    async list(): Promise<DirList[]> {
        return [
            await this.getDirList(this.sourceRoot, this.source),
            await this.getDirList(this.targetRoot, this.target)
        ]
    }

    async getDirList(root, dirpath): Promise<DirList> {
        const dirlist = await fs.readdir(dirpath);
        const entries: Entry[] = [
            {
                directory: true,
                name: '..'
            }
        ]
        for (const entryName of dirlist) {
            try {
                let stats = await fs.stat(path.join(dirpath, entryName));
                if (!exclude(entryName)) {
                    entries.push({
                        directory: stats.isDirectory(),
                        name: entryName
                    })
                }
            } catch (e) {
                console.error(e)
            }
        }
        return {
            breadcrumb: makeBreadCrumb(root, dirpath),
            entries: entries
        } as DirList
    }

    async cdFromDir(newdir: string) {
        const newpath = await this.cd(this.source, newdir)
        if (newpath.startsWith(this.sourceRoot)) {
            this.source = newpath
        }
    }

    async cdToDir(newdir: string) {
        const newpath = await this.cd(this.target, newdir)
        console.log(`attempt to change target dir: ${newpath}`)
        if (newpath.startsWith(this.targetRoot)) {
            this.target = newpath
            console.log(`New target dir: ${this.target}`)
        } else {
            console.log(`New target dir not a subdir of target home: ${this.targetRoot}. Ignoring.`)
        }
    }

    private async cd(olddir: string, newdir: string) {
        console.log(`cd: newdir: ${newdir}`)
        const newpath = path.resolve(path.join(olddir, newdir))

        await fs.stat(newpath)
        if (newpath.startsWith(this.sourceRoot)) {
            console.log(`Changing cwd to ${newpath}`)
        } else {
            console.log(`Won't change directories outside home dir.`)
        }
        return newpath
    }

    async newTargetDir(newdir: string) {
        await this.mkdir(newdir)
    }

    // XXX: This is super dangerous. Need to aggresively check this input
    private async mkdir(newdir: string) {
        if (newdir !== '') {
            const newpath = path.resolve(path.join(this.target, newdir))
            if (newpath.startsWith(this.target)) {
                console.log(`mkdir: ${newpath}`)
                try {
                    await fs.mkdir(newpath)
                } catch (e) {
                    console.error(e)
                }
            }
        }
    }

    async translate(name, outstream, progress) {
        const srcpath = path.resolve(path.join(this.source, name))
        const targetpath = path.resolve(path.join(this.target), path.parse(name).name)
        try {
            await fs.stat(targetpath)
            // already exists. bail out.
            outstream.write(`${name} already exists.\n`)
            return
        } catch (err) {

        }
        if (srcpath.startsWith(this.source) && targetpath.startsWith(this.target)) {
            await fs.stat(srcpath)
            await fs.mkdir(targetpath)
        }
        const p = Path.parse(srcpath)
        console.log(`Translate: ${JSON.stringify(p, null, 2)}`)
        switch (p.ext) {
            case '.xpm':
                console.log(`Translate: MPC program: ${srcpath}`)
                await translate.mpc2Sxk(srcpath, targetpath, outstream, progress)
                break
            case '.dspreset':
                console.log(`Translate: Decent Sampler program: ${srcpath}`)
                await translate.decent2Sxk(srcpath, targetpath, outstream, progress)
                break
            default:
                console.log(`Translate: Unknown extension: ${srcpath}`)
                break
        }
    }

    async rmTo(name: string) {
        if (name !== '') {
            const rmpath = path.resolve(path.join(this.target, name))
            if (rmpath.startsWith(this.target) && rmpath !== this.target) {
                console.log(`DELETE: ${rmpath}`)
                if (rmpath.endsWith('.AKP')) {
                    await rmAkp(rmpath)
                } else if ((await fs.stat(rmpath)).isDirectory()) {
                    await fs.rm(rmpath, {recursive: true, force: true})
                }
            }
        }
    }
}

async function rmAkp(programPath: string) {
    try {
        await fs.stat(programPath)
    } catch (e) {
        console.error(e)
        return
    }
    const sampleDir = path.parse(programPath).dir
    const buf = await fs.readFile(programPath)
    const program = newProgramFromBuffer(buf)

    for (const keygroup of program.getKeygroups()) {
        for (const zone of [keygroup.zone1, keygroup.zone2, keygroup.zone3, keygroup.zone4]) {
            const sampleName = zone.sampleName
            if (sampleName !== '') {
                const samplePath = path.join(sampleDir, sampleName + '.WAV')
                try {
                    await fs.rm(samplePath)
                } catch (e) {
                    console.error(e)
                }
            }
        }
    }

    try {
        await fs.rm(programPath)
    } catch (e) {
        console.error(e)
    }

}
