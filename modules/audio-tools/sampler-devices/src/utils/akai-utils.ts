import {nibbles2byte} from "@oletizi/sampler-lib"

const ALPHABET = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ' ', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q',
    'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#', '+', '-', '.']

export function akaiByte2String(bytes: number[]) {
    let rv = ''
    for (let v of bytes) {
        rv += v < ALPHABET.length ? ALPHABET[v] : '?'
    }
    return rv
}

export function string2AkaiBytes(s: string) {
    s = s.toUpperCase()
    const data = []
    for (let i = 0; i < 12; i++) {
        let akaiValue = 10 // default value is ' '
        if (s.length > i) {
            const c = s.charAt(i)
            for (let j = 0; j < ALPHABET.length; j++) {
                if (ALPHABET[j] === c) {
                    akaiValue = j
                }
            }
        }
        data.push(akaiValue)
    }
    return data
}

export function nextByte(nibbles: number[], v: { value: number, offset: number }) {
    v.value = nibbles2byte(nibbles[v.offset], nibbles[v.offset + 1])
    v.offset += 2
    return v
}
