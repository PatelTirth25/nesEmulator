import Mapper from "../lib/Mapper.js";

/**
 * MMC1 (Mapper 1) Implementation.
 * Relies on a 5-bit shift register for CPU writes.
 */
export default class MMC1 extends Mapper {
    constructor(cpu, ppu, cartridge) {
        super(cpu, ppu, cartridge);

        // Internal State Registers (MUST be saved)
        this._shiftRegister = 0x10; // Holds the 5 incoming bits. Starts at 16 (bit 4 set)
        this._shiftCount = 0;       // Counts how many bits have been written (0-4)
        this._control = 0x0C;       // $8000-$9FFF (Initial value: 0b01100: PRG mode 3, V-Mirroring)
        this._prgBank = 0;          // $C000-$DFFF
        this._chrBank0 = 0;         // $A000-$BFFF
        this._chrBank1 = 0;         // $E000-$FFFF

        // Placeholder for bank mapping (MMC1 logic would update these)
        this.currentPrgPage0 = 0;
        this.currentPrgPage1 = 0;
        this.currentChrPage0 = 0;
        this.currentChrPage1 = 0;
    }

    // --- Bank Switching Logic (Implementation omitted for brevity) ---
    cpuWrite(address, value) {
        // MMC1 Register writes occur between $8000 and $FFFF
        if (address >= 0x8000) {
            if (value & 0x80) {
                // Reset: Load 0x10 into shift register, reset control to 0x0C
                this._shiftRegister = 0x10;
                this._shiftCount = 0;
                this._control = 0x0C;
                // The mapping logic would be updated here.
            } else {
                // Shift incoming bit (bit 0 of value) into the register
                const bit = value & 0x01;
                this._shiftRegister = (this._shiftRegister >> 1) | (bit << 4);
                this._shiftCount++;

                if (this._shiftCount === 5) {
                    // Register is full, perform load operation
                    const data = this._shiftRegister & 0x1F;

                    if (address <= 0x9FFF) {
                        this._control = data;
                    } else if (address <= 0xBFFF) {
                        this._chrBank0 = data;
                    } else if (address <= 0xDFFF) {
                        this._prgBank = data;
                    } else { // $E000-$FFFF
                        this._chrBank1 = data;
                    }

                    // Reset shift register for next operation
                    this._shiftRegister = 0x10;
                    this._shiftCount = 0;
                    // The mapping logic would be updated here.
                }
            }
        }
    }
    // --- END Bank Switching Logic ---

    /** Returns a snapshot of the current state. */
    getSaveState() {
        // 1. Get the base state from the Mapper parent class
        const superState = super.getSaveState();

        // 2. Combine with MMC1 specific registers and state
        return {
            ...superState,
            shiftRegister: this._shiftRegister,
            shiftCount: this._shiftCount,
            control: this._control,
            prgBank: this._prgBank,
            chrBank0: this._chrBank0,
            chrBank1: this._chrBank1,
        };
    }

    /** Restores state from a snapshot. */
    setSaveState(saveState) {
        // 1. Restore the base state
        super.setSaveState(saveState);

        // 2. Restore MMC1 specific registers and state
        this._shiftRegister = saveState.shiftRegister;
        this._shiftCount = saveState.shiftCount;
        this._control = saveState.control;
        this._prgBank = saveState.prgBank;
        this._chrBank0 = saveState.chrBank0;
        this._chrBank1 = saveState.chrBank1;

        // NOTE: A real implementation would need to call a 'remap' function here
        // to ensure the internal bank pointers (like this.currentPrgPage0) are updated.
    }
}
