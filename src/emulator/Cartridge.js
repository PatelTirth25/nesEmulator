import bytelib from './lib/byte.js'



export default class Cartridge {
    constructor(bytes) {
        if (bytes[0] != 0x4e || bytes[1] != 0x45 || bytes[2] != 0x53 || bytes[3] != 0x1a) {
            throw new Error("Invalid ROM.");
        }
        this.bytes = bytes
        this.setHeader(bytes)
    }

    setHeader() {
        let bytes = this.bytes;
        let prgRomPages = bytes[4];
        let chrRomPages = bytes[5];
        let usesChrRam = (chrRomPages == 0x00) ? true : false;
        let has512BytePadding = (bytes[6] & 0b00000100) == 0b00000100 ? true : false;
        let hasPrgRam = (bytes[6] & 0b00000010) == 0b00000010 ? true : false;
        let mirroringId = (bytes[6] & 0b00000001) == 0b00000000 ? "HORIZONTAL" : "VERTICAL";
        if ((bytes[6] & 0b00001000) == 0b00001000) {
            mirroringId = "FOUR_SCREEN";
        }
        let lowNmapperId = bytelib.highNybbleOf(bytes[6]);
        let highNmapperId = bytelib.highNybbleOf(bytes[7]);

        let mapperId = bytelib.buildU8(highNmapperId, lowNmapperId);

        this.header = {
            prgRomPages,
            chrRomPages,
            usesChrRam,
            has512BytePadding,
            hasPrgRam,
            mirroringId,
            mapperId
        }
    }

    prg() {
        let size = this.header.prgRomPages * 16384;
        let padding = this.header.has512BytePadding ? 512 : 0;
        return this.bytes.slice(16 + padding, size + 16 + padding);
    }

    chr() {
        if (this.header.usesChrRam == true) {
            return new Uint8Array(8192);
        }

        let sizepgr = this.header.prgRomPages * 16384;
        let sizechr = this.header.chrRomPages * 8192;
        let padding = this.header.has512BytePadding ? 512 : 0;

        return this.bytes.slice(16 + sizepgr + padding, sizepgr + sizechr + 16 + padding);
    }

}
