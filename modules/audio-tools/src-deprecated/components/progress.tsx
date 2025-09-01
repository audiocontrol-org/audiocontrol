"use client"
import LinearProgress from "@mui/material/LinearProgress";
import {useState} from "react";

export const PROGRESS_EVENT = "custom:event:progress"

export default function Progress({eventTarget}: { eventTarget: EventTarget }) {
    const [progress, setProgress] = useState(0)

    eventTarget.addEventListener(PROGRESS_EVENT, (e: CustomEvent) => {
        setProgress(e.detail)
    })
    return (<LinearProgress variant="determinate" value={progress}/>)
}