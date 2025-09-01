import React, {useEffect, useState} from "react";
import {DirectorySpec, FileSet, FileSpec} from "@/lib/lib-fs-api";
import {cdSource, listSource} from "@/lib/client-translator";
import {FileList, newItemAdornments} from "@/components/file-list"
import {Card, CardContent, CardHeader} from "@mui/material";

export function SampleSelectScreen({onSelect, onErrors = e => console.error(e)}: {
    onSelect: (v: string) => void,
    onErrors?: (e: Error[]) => void
}) {
    const [dir, setDir] = useState<string>('/')
    const [files, setFiles] = useState<FileSet>(null)
    useEffect(() => {
        listSource().then(r => {
            if (r.errors.length > 0) {
                onErrors(r.errors)
            } else {
                setFiles(r.data)
                setDir(r.data.path.join('/'))
            }
        })
    }, [dir])

    function visitItem(item: FileSpec | DirectorySpec) {
        const rv = newItemAdornments()
        rv.clickable = item.isDirectory
        rv.translatable = (!item.isDirectory) && item.name.toUpperCase().endsWith('.WAV')
        rv.onClick = () => {
            cdSource(item.name).then(() => setDir(item.name))
        }
        rv.onTranslate = () => {
            //app.setScreen(<ChopDetailScreen file={item.name}/>)
            onSelect(item.name)
        }
        return rv
    }

    return (
        <Card elevation={3} className="w-2/5">
            <CardHeader className="shadow-md" title="Pick a Sample" subheader={dir}/>
            <CardContent style={{maxHeight: 'calc((100vh / 12) * 8)', overflow: 'auto'}}>
                <FileList className="border-t-2" data={files} visit={visitItem}/>
            </CardContent>
        </Card>
    )
}