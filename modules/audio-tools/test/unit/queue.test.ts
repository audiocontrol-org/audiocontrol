import fs, {ReadStream, write} from "fs";
import path from "path";
import Queue from "queue"
import {Duplex, PassThrough} from "stream";

describe('Stream', async () => {
    it('Starts a queue', async () => {

        const results = []
        const myqueue = new Queue({results: results, autostart: true})


        const mystream = fs.createReadStream(path.join(process.env.HOME, 'tmp', 'test.m4a'))
        mystream.addListener('end', () => {
            console.log("END!!!!!!!!!")
        })

        myqueue.push(runTask)
        // await myqueue.start()
        async function runTask() {
            for await (const chunk of mystream) {
                console.log(chunk)
            }
        }
    })
    it('Does streamy stuff', async () =>{
        const decoder = new TextDecoder()
        const duplex = new PassThrough()

        duplex.write('Wrote something nice.\n')

        duplex.pipe(process.stdout)

        const chunk = await duplex.read()

        console.log(`Decoded: ` + decoder.decode(chunk))

    })
})