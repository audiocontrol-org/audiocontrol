export interface Entry {
    name: string
    directory: boolean
}

export interface DirList {
    breadcrumb: string
    entries: Entry[]
}

