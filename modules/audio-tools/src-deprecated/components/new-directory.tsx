import {useState} from "react";
import {TextField} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";

export default function NewDirectory({inputHandler}: { inputHandler: (dirname: string) => void }) {
    const [dirname, setDirname] = useState('')
    return (
        <form onSubmit={(e) => {
            e.preventDefault()
            inputHandler(dirname)
            setDirname('')
        }}>
            <div className="flex items-center gap-3">
                <TextField value={dirname}
                           label="new folder name"
                           onChange={(e) => setDirname(e.target.value)}/>
                <IconButton onClick={() => inputHandler(dirname)}><CreateNewFolderIcon className="text-blue-500"
                                        style={{fontSize: '3rem'}}/></IconButton>

            </div>
        </form>
    )
}