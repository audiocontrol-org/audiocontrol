import React, {useState} from 'react'
import {MutableNumber, natural2real, real2natural} from "@/lib/lib-core";
import {Box, Card, createListCollection, Flex, ListCollection} from "@chakra-ui/react";
import {Slider} from '@/components/chakra/slider'
import {
    SelectContent,
    SelectItem,
    SelectLabel,
    SelectRoot,
    SelectTrigger,
    SelectValueText
} from '@/components/chakra/select'

export interface Option {
    label: string
    value: string
    selected: boolean
}

export interface Selectable {
    onSelect: Function
    options: Option[]
}


export function MutableSlider({data, label}: { data: MutableNumber, label: string }) {
    if (data.value == undefined) {
        return (
            <Slider disabled label={label + ': Borken. Value is undefined.'}/>
        )

    }
    const [naturalValue, setNaturalValue] = useState([real2natural(data.value, data.min, data.max)])
    const realValue = natural2real(naturalValue[0], data.min, data.max)
    const naturalMin = 0
    const naturalMax = data.max - data.min


    return (
        <Slider
            onValueChange={(event) => setNaturalValue(event.value)}
            onValueChangeEnd={async (event) => {
                const val = event.value
                const naturalVal = val[0]
                const realVal = natural2real(naturalVal, data.min, data.max)
                setNaturalValue(val)
                await data.mutator(realVal)
            }}
            label={`${label} (${realValue})`}
            min={naturalMin}
            max={naturalMax}
            value={naturalValue}
        />
    )
}

export function SimpleSelect({options, mutator, label}:
                                 { options: Option[], mutator: Function, label: string }) {
    const items: ListCollection<Option> = createListCollection({items: options})
    const [selected, setSelected] = useState(items.items.filter(o => o.selected).map((o => o.value)))

    return (
        <SelectRoot collection={items} value={selected} onValueChange={
            (event) => {
                setSelected(event.value)
                mutator(event.value)
            }
        }>
            <SelectLabel>{label}</SelectLabel>
            <SelectTrigger>
                <SelectValueText placeholder={'Select...'}/>
            </SelectTrigger>
            <SelectContent>
                {options.map((o) => (
                    <SelectItem item={o} key={o.value}>{o.label}</SelectItem>
                ))}
            </SelectContent>
        </SelectRoot>
    )
}

export function ControlPanel({children, title}) {
    return (
        <Card.Root flexGrow={1} minW={200}>
            <Card.Body gap={4}>
                <Card.Title>{title}</Card.Title>
                <Flex direction={'column'} gap={4}>{children}</Flex>
            </Card.Body>
        </Card.Root>
    )
}
