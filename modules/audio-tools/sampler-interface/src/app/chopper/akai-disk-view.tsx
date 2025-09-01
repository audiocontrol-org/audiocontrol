import {
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    Collapse,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText
} from "@mui/material";
import React, {useEffect, useState} from "react";
import {AkaiDisk, AkaiPartition, AkaiRecordType, AkaiVolume} from "@/model/akai";
import RefreshIcon from '@mui/icons-material/Refresh'
import StorageIcon from '@mui/icons-material/Storage';
import SaveIcon from '@mui/icons-material/Save';
import {AudioFile, ExpandLess, ExpandMore} from "@mui/icons-material";
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import SyncIcon from '@mui/icons-material/Sync';

import {ChopApp} from "@/app/chopper/chop-app";

let seq = 0

export function AkaiDiskView({app}: { app: ChopApp }) {
    const [disk, setDisk] = useState<AkaiDisk>({name: "Default", partitions: [], timestamp: 0})
    app.addDiskListener((d: AkaiDisk) => {
        setDisk(d)
    })
    useEffect(() => app.fetchDisk(), [])
    let items = 0
    return (
        <Card elevation={3} sx={{minWidth: '250px'}}>
            <CardHeader className="shadow-md" title="Your Disk So Far" subheader={disk.name}/>
            <CardContent style={{height: 'calc((100vh / 12) * 7)', overflow: 'auto'}}>
                {disk.partitions.map(partition => {
                    items++
                    return (
                        <List key={partition.name + '-' + seq} sx={{width: '100%'}}>
                            <PartitionView data={partition} openDefault={items === 1}/>
                        </List>)
                })}
            </CardContent>
            <CardActions>
                <Button onClick={() => {
                    app.fetchDisk()
                }}><RefreshIcon/></Button>
                <Button onClick={() => {
                    app.syncRemote().then(r => {
                        console.log(`Sync result: ${r}`)
                    })
                }}><SyncIcon/>Sync Remote</Button>
            </CardActions>
        </Card>)
}

function PartitionView({data, openDefault}: { data: AkaiPartition, openDefault: boolean }) {
    const [open, setOpen] = useState(openDefault)
    let items = 0
    return (<>
            <ListItemButton onClick={() => setOpen(!open)}>
                <ListItemIcon><StorageIcon/></ListItemIcon>
                <ListItemText primary={`Part. ${data.name}`}/>
                {open ? <ExpandLess/> : <ExpandMore/>}
            </ListItemButton>
            <Collapse in={open}>
                <List sx={{width: '100%'}} dense={true} disablePadding>
                    {data.volumes.map(volume => {
                        items++
                        return (<VolumeView key={volume.name} openDefault={items === 1} data={volume}/>)
                    })}
                </List>
            </Collapse>
        </>
    )
}

function VolumeView({data, openDefault}: { data: AkaiVolume, openDefault: boolean }) {
    const [open, setOpen] = useState(openDefault)
    return (<>
            <ListItemButton onClick={() => setOpen(!open)}>
                <ListItemIcon><SaveIcon/></ListItemIcon>
                <ListItemText primary={data.name.split('/').pop()}/>
                {open ? <ExpandLess/> : <ExpandMore/>}
            </ListItemButton>
            <Collapse in={open}>
                <List sx={{width: '100%'}} dense={true} disablePadding>
                    {data.records.map(record => {
                        return (
                            <ListItem className="bg-gray-50" sx={{pl: 2}} key={record.name + '-' + seq++} disableGutters>
                                <ListItemIcon>
                                    {record.type === AkaiRecordType.SAMPLE ? <AudioFile/> :
                                        <LibraryBooksIcon/>}
                                </ListItemIcon>
                                <ListItemText primary={record.name.split('/').pop()}/>
                            </ListItem>)
                    })}
                </List>
            </Collapse>
        </>
    )
}
