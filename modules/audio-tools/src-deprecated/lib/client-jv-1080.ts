import {newClientCommon} from "@/lib/client-common";
import {Midi} from "@/midi/midi";

const clientCommon = newClientCommon((msg) => console.log(msg), (msg) => console.error(msg))
const out = clientCommon.getOutput()
const midi = new Midi()
