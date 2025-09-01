import {TextField} from "@mui/material";
import {useState} from "react";

export interface TerminalNotifier {
    addListener(l:TerminalListener)
}

export interface TerminalListener {
    append(data:string)
    clear()
}

export default function Terminal({notifier, label, maxRows}: { notifier: TerminalNotifier }) {
    const [data, setData] = useState('')
    console.log(`Terminal: adding this as listener...`)
    notifier.addListener({
        append(d: string) {
            console.log(`Terminal: append(${d})`)
            setData(data + d)
        }, clear() {
            setData('')
        }
    })
    return (<TextField maxRows={maxRows} label={label} value={data} multiline/>)
}