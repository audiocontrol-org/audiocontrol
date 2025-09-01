import {Typography} from "@mui/material";

export default function FieldDisplay({label, value, className = ''}) {
    return (<div className={`flex gap-4 grow ${className}`}>
        <div className="grow"><Typography variant="body2">{label}</Typography></div>
        <div><Typography variant="body2">{value}</Typography></div>
    </div>)
}