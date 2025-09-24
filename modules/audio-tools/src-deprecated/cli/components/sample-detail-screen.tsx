import {Sample} from "@/midi/devices/s3000xl.js";
import React from "react";
import {Box, Text} from 'ink'
import {CliApp} from "@/cli/cli-app.js";

export function SampleDetailScreen({app, sample}: { app: CliApp, sample: Sample }) {
    return (
        <Box>
            <Text>Sample detail for: {sample.getSampleName()}</Text>
        </Box>)
}

