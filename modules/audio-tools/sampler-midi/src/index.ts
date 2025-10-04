// Re-export akaitools from sampler-devices for backward compatibility
export {
    newAkaitools,
    newAkaiToolsConfig,
    readAkaiData,
    writeAkaiData,
    CHUNK_LENGTH,
    RAW_LEADER,
    type Akaitools,
    type AkaiProgramFile,
    type ExecutionResult
} from "@oletizi/sampler-devices"

export * from "@/client/client-akai-s3000xl.js"
