import React, {useEffect, useRef, useState} from "react";
import {Box, Text, measureElement} from "ink"

export function Slider({defaultValue, min, max}: { defaultValue: number, min: number, max: number }) {
    const [size, setSize] = useState(10)
    const ref = useRef()

    useEffect(() => {
        const {width, height} = measureElement(ref.current)
        setSize(width)
    }, [])
    return (<Box ref={ref}><Text>I'm a slider! Size: {size}</Text></Box>)
}