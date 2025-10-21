import Mapper from "../lib/Mapper.js";

export default class NROM extends Mapper {
    constructor() {
        super()
        this.page = 0
    }

    cpuRead(address) {
        if (address >= 0x4020 && address <= 0x7FFF) return 0
        if (address >= 0x8000 && address <= 0xBFFF) return this.$getPrgPage(this.page)[address - 0x8000]
        if (address >= 0xC000 && address <= 0xFFFF) return this.$getPrgPage(this.prgPages.length - 1)[address - 0xC000]
    }

    cpuWrite(address, value) {
        if (address >= 0x8000) this.$getPrgPage(this.page)[address - 0x8000] = value
    }

    ppuRead(address) {
        return this.$getChrPage(0)[address]
    }

    ppuWrite(address, value) {
        if (!this.cartridge.header.usesChrRam) {
            return
        }
        this.$getChrPage(0)[address] = value
    }

    getSaveState() {
        const superState = super.getSaveState();
        return {
            ...superState,
            page: this.page
        };
    }

    setSaveState(saveState) {
        super.setSaveState(saveState);
        this.page = saveState.page;
    }

}
