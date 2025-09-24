import readline from 'node:readline'
import midi from "midi";
import {newServerOutput} from "@/lib/process-output.js";
import {newDevice} from "@/midi/akai-s3000xl.js";

const rl = readline.createInterface(process.stdin, process.stdout);
const stdout = process.stdout
const out = newServerOutput(true, 'cli-s3000xl')


const mainMenu = `
p: programs
s: samples
q: quit

> `

const midiInput = new midi.Input()
const midiOutput = new midi.Output()

midiInput.ignoreTypes(false, false, false)

out.log(`Opening midi input...`)
openPort(midiInput)

out.log(`Opening midi output....`)
openPort(midiOutput)

const device = newDevice(midiInput, midiOutput, out)
device.init()

main()


function main() {
    rl.question(mainMenu, (i) => {
        switch (i) {
            case "s":
                sample().then(main)
                break
            case "p":
                program().then(main)
                break
            case "q":
                stdout.write(`Goodbye!`)
                midiInput.closePort()
                midiOutput.closePort()
                rl.close()
                break
            default:
                main()
        }
    })
}

async function sample() {
    for (const name of  await device.fetchProgramNames([]))  {
        stdout.write(name + '\n')
    }
}

async function program() {
    const names = []
    out.log(`Fetching program names...`)
    await device.fetchProgramNames(names)
    out.log(`Done fetching program names.`)
    out.log(names)
}

function openPort(io: midi.Input | midi.Output) {
    for (let i = 0; i < io.getPortCount(); i++) {
        const name = io.getPortName(i)
        if (!name.startsWith('IAC')) {
            io.openPort(i)
        }
    }
}

