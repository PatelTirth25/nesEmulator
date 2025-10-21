import Mapper from "../lib/Mapper.js";

/**
 * CNROM (Mapper 3) Implementation.
 * PRG is fixed (like NROM). CHR is bank-switched via any CPU write to $8000-$FFFF.
 */
export default class CNROM extends Mapper {
    constructor(cpu, ppu, cartridge) {
        super(cpu, ppu, cartridge);

        // Internal State Register (MUST be saved)
        this._chrBank = 0; // Current index of the 8KB CHR bank
    }

    // --- Bank Switching Logic ---
    // Any CPU write to $8000-$FFFF sets the CHR bank
    cpuWrite(address, value) {
        if (address >= 0x8000) {
            // CNROM uses the lowest 2 bits of the value for the 8KB CHR bank index
            this._chrBank = value & 0x03;
        }
    }

    cpuRead(address) {
        // PRG ROM is fixed, mirrored if 16KB
        if (address >= 0x8000 && address <= 0xFFFF) {
            const pageIndex = address >= 0xC000 ? this.prgPages.length - 1 : 0;
            return this.$getPrgPage(pageIndex)[address % 0x4000];
        }
        return 0; // Default or $4020-$7FFF
    }

    ppuRead(address) {
        // CHR ROM is fully bank-switched (8KB pages)
        if (address <= 0x1FFF) {
            return this.$getChrPage(this._chrBank)[address];
        }
    }
    // --- END Bank Switching Logic ---

    /** Returns a snapshot of the current state. */
    getSaveState() {
        // 1. Get the base state from the Mapper parent class
        const superState = super.getSaveState();

        // 2. Combine with CNROM specific state
        return {
            ...superState,
            chrBank: this._chrBank,
        };
    }

    /** Restores state from a snapshot. */
    setSaveState(saveState) {
        // 1. Restore the base state
        super.setSaveState(saveState);

        // 2. Restore CNROM specific state
        this._chrBank = saveState.chrBank;
    }
}
