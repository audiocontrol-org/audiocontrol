"use client"
import {SampleSelectScreen} from "@/app/chopper/sample-select-screen";
import {newClientConfig} from "@/lib/config-client";
import {newClientOutput} from "@/lib/process-output";
import {ChopApp} from "@/app/chopper/chop-app";
import {ChopDetailScreen} from "@/app/chopper/chop-detail-screen";
import React, {useState} from "react";
import {AkaiDiskView} from "@/app/chopper/akai-disk-view";


const config = newClientConfig()
const out = newClientOutput(true, 'Chopper')
const app = new ChopApp(config, out)
export default function Page() {
    const [file, setFile] = useState<string | null>(null)

    return (
        <div className="container mx-auto flex-column">
            <div className="flex" style={{height: 'calc((100vh / 12) * 2)'}}>
                <div className="mt-5 text-2xl text-red-600">Akai S3000XL Chopper</div>
            </div>
            <div className="flex gap-10" style={{maxHeight: '100vh'}}>
                <SampleSelectScreen onSelect={v => setFile(v)}/>
                <ChopDetailScreen app={app} defaultDirectory="/"
                                  file={file}
                                  onErrors={(e) => console.log(e)}/>
                <AkaiDiskView app={app}/>
            </div>
        </div>)
}

