import React from "react";
import {newClientConfig} from "@/lib/config-client";
import {newClientOutput} from "@/lib/process-output";

const config = newClientConfig()
const out = newClientOutput(true, 'Chopper')
export default function Page() {
    return (
        <div className="container mx-auto flex-column">
            <div className="flex" style={{height: 'calc((100vh / 12) * 2)'}}>
                <div className="mt-5 text-2xl text-red-600">Akai S3000XL Mapper</div>
            </div>
            <div className="flex gap-10" style={{maxHeight: '100vh'}}>
                <div>Hi. Do stuff here</div>
            </div>
        </div>)
}