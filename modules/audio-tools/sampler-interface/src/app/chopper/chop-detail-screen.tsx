import React, {useEffect, useState} from "react";
import {Sample, SampleMetadata} from "@/model/sample";
import {getAudioData, getMeta} from "@/lib/client-translator";
import {Howl} from 'howler'
import {
    Alert, Box,
    Button,
    Card, CardActions,
    CardContent,
    CardHeader,
    Paper,
    Skeleton,
    Snackbar,
    TextField
} from "@mui/material";
import NumberInput from "@/components/number-input"
import {ChopApp} from "@/app/chopper/chop-app";
import {AkaiDisk} from "@/model/akai";
import {WaveformView} from "@/components/waveform-view";
import {Transport} from "@/components/transport";
import FieldDisplay from "@/components/field-display";

export function ChopDetailScreen(
    {
        app,
        file,
        onErrors = (e) => console.error(e)
    }: {
        app: ChopApp,
        file: string | null,
        onErrors: (e: Error | Error[]) => void,
    }) {
    const [meta, setMeta] = useState<SampleMetadata | null>(null)
    const [sample, setSample] = useState<Sample>(null)
    const [audioSource, setAudioSource] = useState<Howl>(null)
    const [bpm, setBpm] = useState<number>(120)
    const [beatsPerChop, setBeatsPerChop] = useState<number>(4)
    const [chops, setChops] = useState<{ start: number, end: number }[]>(null)
    const [prefix, setPrefix] = useState<string>('chop.01')
    const [disk, setDisk] = useState<AkaiDisk>({name: "", partitions: [], timestamp: 0})
    const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false)
    const [snackbarMessage, setSnackbarMessage] = useState<string>("Hi. I'm a snackbar!")
    const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "info" | "warning" | "error">("warning")

    app.addDiskListener((d: AkaiDisk) => {
        setDisk(d)
    })
    useEffect(() => {
        app.fetchDisk()
    }, [])
    useEffect(() => {
        setChops(getChops(getSamplesPerBeat(), beatsPerChop, getTotalChops()))
    }, [meta, bpm, beatsPerChop])
    useEffect(() => {
        if (file) {
            getMeta(file).then(r => {
                if (r.errors.length) {
                    onErrors(r.errors)
                } else {
                    setMeta(r.data)
                }
            })
            getAudioData(file).then(r => {
                if (r.errors.length) {
                    onErrors(r.errors)
                } else {
                    const s: Sample = r.sample
                    setSample(s)
                    setAudioSource(new Howl({
                        src: [URL.createObjectURL(new Blob([r.data], {type: 'audio/wav'}))],
                        format: ['wav']
                    }))
                }
            })
        }
    }, [file])

    function validateChop(file: string, partition: number, prefix: string) {
        let rv = partition > 0 && partition <= disk.partitions.length
        if (rv) {
            for (const v of disk.partitions[partition - 1].volumes) {
                const volumeName = v.name.split('/').pop()?.trim()
                if (volumeName === prefix.trim()) {
                    setSnackbarMessage(`${prefix} already exists. Choose a different program name.`)
                    setSnackbarSeverity("warning")
                    setSnackbarOpen(true)
                    return false
                }
            }
        } else {
            setSnackbarMessage(`Invalid disk partition: ${partition}`)
            setSnackbarSeverity("warning")
            setSnackbarOpen(true)
        }
        return rv
    }

    function getSamplesPerBeat() {
        return Math.round(meta?.sampleRate / (bpm / 60))
    }

    function getTotalChops() {
        return Math.round(meta?.sampleLength / (getSamplesPerBeat() * beatsPerChop))
    }

    function getTotalBeats() {
        return Math.round(meta?.sampleLength / getSamplesPerBeat())
    }

    function getChops(samplesPerBeat, beatsPerChop, totalChops) {
        console.log(`Getting chops...`)
        const rv = []
        if (meta) {
            const samplesPerChop = samplesPerBeat * beatsPerChop
            console.log(`Samples per chop: ${samplesPerChop}`)
            console.log(`Total chops: ${totalChops}`)
            for (let i = 0; i < totalChops; i++) {
                const start = i * samplesPerChop;
                console.log(`Start [${i}]: ${start}; end: ${start + samplesPerChop}`)
                rv.push({start: start, end: start + samplesPerChop})
            }
        }
        console.log(`Returning chops:`)
        console.log(JSON.stringify(rv))
        return rv
    }

    return (
        <Card className="grow" elevation="3">
            <CardHeader className="shadow-md" title={`Chop it!`}
                        subheader={`${file ? file : '(Choose a file)'}`}/>
            <CardContent>

                <div className="flex flex-col gap-4">
                    {sample ? (<WaveformView sample={sample} height={30} color="#666" chops={chops}/>) :
                        <Skeleton height={30}/>}
                    {meta ? (
                            <>
                                <Paper variant="outlined"><Metadata meta={meta} padding={3} gap={5}/></Paper>
                                <Paper variant="outlined" className="flex gap-10 p-3">
                                    <FieldDisplay className="w-1/2" label="Total Beats" value={getTotalBeats()}/>
                                    <FieldDisplay className="w-1/2" label="Total Chops" value={getTotalChops()}/>
                                </Paper>
                                <Box className="flex gap-4">
                                    <NumberInput className="w-1/2"
                                                 label="BPM"
                                                 defaultValue={bpm}
                                                 min={1}
                                                 max={300}
                                                 onChange={(v) => setBpm(v)}/>

                                    <NumberInput className="w-1/2"
                                                 label="Beats per Chop"
                                                 defaultValue={beatsPerChop}
                                                 min={1}
                                                 max={32}
                                                 onChange={(v) => setBeatsPerChop(v)}/>
                                </Box>
                                <Box className="flex" gap={4}>
                                    <TextField className="grow" label="Prog. Name" value={prefix}
                                               onChange={e => setPrefix(e.target.value)}/>
                                </Box>
                                <CardActions>
                                    <Button variant="contained"
                                            onClick={() => {
                                                if (file) {
                                                    const partition = 1
                                                    if (validateChop(file, partition, prefix)) {
                                                        app.chop(file, partition, prefix, getSamplesPerBeat(), beatsPerChop).then(r => {
                                                            if (r.errors?.length > 0) {
                                                                setSnackbarSeverity("warning")
                                                                setSnackbarMessage(r.errors[0].message)
                                                                setSnackbarOpen(true)
                                                            } else {
                                                                setSnackbarSeverity("success")
                                                                setSnackbarMessage(`Chop ${prefix} created.`)
                                                                setSnackbarOpen(true)
                                                                app.fetchDisk()
                                                            }
                                                        })
                                                    }
                                                }
                                            }}>Do It!</Button>
                                    <Transport listener={(playing) => {
                                        playing ? audioSource.stop() : audioSource.play()
                                    }}/>
                                    <Snackbar
                                        open={snackbarOpen}
                                        autoHideDuration={6000}
                                        onClose={() => setSnackbarOpen(false)}>
                                        <Alert
                                            onClose={() => setSnackbarOpen(false)}
                                            severity={snackbarSeverity}
                                            variant="filled"
                                            sx={{width: '100%'}}>
                                            {snackbarMessage}
                                        </Alert>
                                    </Snackbar>
                                </CardActions>
                            </>) :
                        (<></>)
                    }
                </div>
            </CardContent>
        </Card>
    )
}

function Metadata({meta, className = '', gap = 4, padding = 3}: { meta: SampleMetadata | null }) {
    if (!meta) {
        return (<></>)
    }
    return (
        <div className="flex-col gap-4">
            <Box className={`flex gap-${gap} grow ${className}`}>
                <FieldDisplay className={`w-1/2 p-${padding}`} label="Sample Rate" value={meta.sampleRate}/>
                <FieldDisplay className={`w-1/2 p-${padding}`} label="Channel Count" value={meta.channelCount}/>
            </Box>
            <Box className={`flex gap-${gap} grow ${className}`}>
                <FieldDisplay className={`w-1/2 p-${padding}`} label="Bit Depth" value={meta.bitDepth}/>
                <FieldDisplay className={`w-1/2 p-${padding}`} label="Sample Length" value={meta.sampleLength}/>
            </Box>
        </div>
    )
}