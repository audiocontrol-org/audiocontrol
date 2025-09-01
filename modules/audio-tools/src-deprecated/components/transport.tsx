import {Button} from "@mui/material";
import {useState} from "react";

export type TransportListener = (playing: boolean) => void

export function Transport({listener}: { listener: TransportListener }) {
    const [playing, setPlaying] = useState<boolean>(false)
    return <Button onClick={() => {
        const state = !playing
        setPlaying(!playing)
        listener(!state)
    }}>{playing ? 'Stop' : 'Play'}</Button>
}