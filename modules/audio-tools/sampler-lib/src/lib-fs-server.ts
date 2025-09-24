import fs from "fs/promises";

export async function mkdir(dir: string) {
    if (!dir) return false

    try {
        return (await fs.stat(dir)).isDirectory()
    } catch (e) {
        try {
            await fs.mkdir(dir)
            return true
        } catch (e) {
            return false
        }
    }
}
