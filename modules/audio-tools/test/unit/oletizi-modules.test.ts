import {hello, description} from '@oletizi/translate'
import {expect} from "chai";

describe('Testing @oletizi modules', () => {
    it('Says hello.', () => {
        expect(hello()).eq("Hello")
    })
    it ('Exports description() from lib-translate', () => {
        console.log(description())
    })
})