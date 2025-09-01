import {useEffect, useRef, useState} from "react";
import {Sample} from "@/model/sample";
import {scale} from "@/lib/lib-core";
import {Canvas, Group, Line, Polyline, Rect, XY} from "fabric"
import {Howl} from "howler";

interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Region extends Rectangle {
    isActive: boolean
    group: Group
}

export function WaveformView({sample, width, height, color, chops}: {
    sample: Sample,
    chops: { start: number, end: number }[]
}) {
    const [regions, setRegions] = useState<Region[]>([])
    const [waveformData, setWaveformData] = useState<number[]>([])
    const audioSourceRef = useRef<Howl | null>(null)
    const canvasContainerRef = useRef<HTMLDivElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const fabricRef = useRef<Canvas | null>(null)
    const waveformRef = useRef<Polyline | null>(null)

    function resizeCanvas() {
        const container = canvasContainerRef.current
        const canvas = fabricRef.current
        if (container && canvas) {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            canvas.setDimensions({width: containerWidth, height: containerHeight})
            canvas.calcOffset();
        }
    }

    // prepare waveform canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas) {
            const height = canvas.clientHeight
            const width = canvas.clientWidth
            const mid = Math.round(height / 2)
            const c = fabricRef.current = new Canvas(canvas, {selection: false})
            c.hoverCursor = 'default'
            resizeCanvas()
            fabricRef.current?.add(new Line([0, mid, width, mid], {stroke: color, strokeWidth: 2}))
            paint()
        }
        return () => {
            fabricRef.current?.dispose()
        }
    }, [])

    //  Calculate waveform on new sample
    useEffect(() => {

        const container = canvasContainerRef.current
        if (container) {
            const width = container.clientWidth
            const height = container.clientHeight
            // const ctx = canvas.getContext('2d')
            const data = sample.getSampleData()
            const mid = height / 2
            let sum = 0
            // Calculate waveform
            const chunkLength = Math.round(scale(1, 0, width, 0, data.length / sample.getChannelCount()))
            waveformData.length = 0
            for (let i = 0; i < data.length; i += sample.getChannelCount()) {
                const datum = Math.abs(data[i])
                sum += datum * datum

                if (i % (chunkLength * sample.getChannelCount()) === 0) {
                    const rms = Math.sqrt(sum / chunkLength)
                    const max = Math.pow(2, sample.getBitDepth()) / 2
                    const rmsScaled = Math.round(scale(rms, 0, max, 0, mid))
                    waveformData.push(rmsScaled)
                    sum = 0
                }
            }
            setWaveformData(waveformData)
            // Construct waveform object
            const points: XY[] = []
            let x = 0
            for (const v of waveformData) {
                points.push({x: x, y: mid + v})
                points.push({x: x, y: mid - v})
                x++
            }

            let waveform = waveformRef.current
            if (waveform) {
                fabricRef.current?.remove(waveform)
            }
            waveform = new Polyline(points, {stroke: color, strokeWidth: 1, selectable: false})
            waveformRef.current = waveform
            if (fabricRef.current instanceof Canvas) {
                fabricRef.current.add(waveform)
            }

            fabricRef.current?.add(waveform)
            paint()
        }
    }, [sample])

    // Calculate chop regions to superimpose on waveform
    useEffect(() => {
        // const canvas = canvasRef.current
        const container = canvasContainerRef.current
        const canvas = fabricRef.current

        if (container && canvas) {

            const width = container.clientWidth
            const height = container.clientHeight
            const data = sample.getSampleData()

            // calculate regions
            const chopRegions: Region[] = []
            if (chops) {
                const sprite = {}
                const sampleMillis = ((data.length / sample.getChannelCount()) / sample.getSampleRate()) * 1000
                for (const c of chops) {
                    const startX = scale(c.start, 0, data.length / sample.getChannelCount(), 0, width)
                    const endX = scale(c.end, 0, data.length / sample.getChannelCount(), 0, width)

                    const spriteId = String('sprite-' + chopRegions.length)
                    const spriteStart = scale(c.start, 0, data.length / sample.getChannelCount(), 0, sampleMillis)
                    const spriteDuration = scale(c.end - c.start, 0, data.length / sample.getChannelCount(), 0, sampleMillis)
                    sprite[spriteId] = [spriteStart, spriteDuration, true]

                    let region: Region = {
                        x: startX,
                        y: 0,
                        width: endX - startX,
                        height: height,
                        isActive: false,
                        group: new Group()
                    }
                    const chopTickColor = 'rgb(25, 118, 210)'
                    const chopRegionColor = 'rgb(25, 118, 210, 0.3)'
                    const lineStart = new Line([region.x, region.y, region.x, region.height], {
                        stroke: chopTickColor,
                        strokeWidth: 1,
                        selectable: false
                    })
                    const regionRect: Rect = new Rect({
                        left: region.x,
                        top: 0,
                        fill: 'transparent', // no fill, so only the stroke is visible
                        stroke: 'transparent',      // stroke color
                        width: region.width, //150,
                        height: height,
                        selectable: false
                    })
                    region.group.on('mouseover', () => {
                        regionRect.set('fill', chopRegionColor)
                        paint()

                    })
                    region.group.on('mouseout', () => {
                        regionRect.set('fill', 'transparent')
                        paint()
                    })

                    region.group.on('mousedown', () => {
                        audioSourceRef.current?.play(spriteId)
                    })
                    region.group.on('mouseup', () => {
                        audioSourceRef.current?.stop()
                    })

                    region.group.add(lineStart)
                    region.group.add(regionRect)
                    fabricRef.current?.add(region.group)
                    chopRegions.push(region)
                }
                if (regions) {
                    // remove the old regions
                    for (const region of regions) {
                        fabricRef.current?.remove(region.group)
                    }
                }
                audioSourceRef.current?.unload()
                audioSourceRef.current = new Howl({
                    src: [URL.createObjectURL(new Blob([sample.getRawData()], {type: 'audio/wav'}))],
                    sprite: sprite,
                    format: ['wav']
                })
                setRegions(chopRegions)
            }
            paint()
        }
        return () => {
            audioSourceRef.current?.unload()
        }
    }, [sample, chops])

    function paint() {
        const canvas = fabricRef.current
        if (canvas) {
            canvas.getObjects().forEach(o => {
                o.selectable = false
            })
            canvas.renderAll()
        }
    }

    return <div ref={canvasContainerRef} className="border-2">
        <canvas ref={canvasRef} height={height} width={width}/>
    </div>
}