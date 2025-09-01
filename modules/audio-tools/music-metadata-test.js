import {parseFile} from "music-metadata"
import path from "path";

const filepath = path.join('test', 'data', 'auto', 'J8.01', 'J8-1DY0.01-C4-V127.aif')
parseFile(filepath)
    .then(m => {
        console.log(`metadata:`)
        console.log(m)
    }).catch(e => {
    console.error(e)
})
