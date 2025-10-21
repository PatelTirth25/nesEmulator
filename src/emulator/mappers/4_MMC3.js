import Mapper from "../lib/Mapper.js";

/**
 * MMC3 (Mapper 4) Implementation.
 * Complex mapper with scanline-based IRQs and extensive bank switching.
 */
export default class MMC3 extends Mapper {
    constructor(cpu, ppu, cartridge) {
        super(cpu, ppu, cartridge);

        // --- Bank Switching State (MUST be saved) ---
        this._prgBankMode = 0;       // Bit 6 of $8000 (even)
        this._chrBankMode = 0;       // Bit 7 of $8000 (even)
        this._registerSelect = 0;    // Index R0-R7 set by $8000 (even)
        this._registers = new Uint8Array(8).fill(0); // Bank values for R0-R7

        // --- IRQ State (MUST be saved) ---
        this._irqLatch = 0;          // $C000 (even) - Value to reload the counter with
        this._irqCounter = 0;        // Current countdown value
        this._irqEnabled = false;    // $E000 (odd) enables, $E000 (even) disables
        this._irqReloadPending = false; // Flag to indicate a reload is pending (from $C000 odd write)
        this._lastChrA12 = false;    // Tracks PPU A12 signal for scanline counting
    }

    // --- IRQ and Tick Logic (Crucial for state) ---
    cpuWrite(address, value) {
        if (address >= 0x8000) {
            // $8000-$9FFF (even/odd) - Bank Select / Data
            if (address <= 0x9FFF) {
                if (address % 2 === 0) { // $8000 (even) - Bank Select
                    this._registerSelect = value & 0x07;
                    this._prgBankMode = (value >> 6) & 0x01;
                    this._chrBankMode = (value >> 7) & 0x01;
                } else { // $8001 (odd) - Bank Data
                    this._registers[this._registerSelect] = value;
                    // In a real implementation, a 'remap' function would be called here.
                }
            }
            // $C000-$DFFF - IRQ Latch / Reload
            else if (address <= 0xDFFF) {
                if (address % 2 === 0) { // $C000 (even) - IRQ Latch
                    this._irqLatch = value;
                } else { // $C001 (odd) - IRQ Reload
                    this._irqCounter = 0; // The official behavior is more complex, but this is simplified
                    this._irqReloadPending = true;
                }
            }
            // $E000-$FFFF - IRQ Enable / Disable
            else if (address <= 0xFFFF) {
                if (address % 2 === 0) { // $E000 (even) - IRQ Disable
                    this._irqEnabled = false;
                    this.cpu.clearIrq(); // Assuming the CPU has a method to clear the IRQ status
                } else { // $E001 (odd) - IRQ Enable
                    this._irqEnabled = true;
                }
            }
        }
    }

    // MMC3 IRQ logic happens when PPU A12 transitions from low to high.
    // The logic is typically placed in a separate 'tick' or 'ppuAddressBusWrite' method.
    tick() {
        // This is the simplified IRQ logic based on PPU scanline tick (A12 line)
        // A real MMC3 would monitor PPU bus writes for A12 changes.
        // We only need the state variables for the save state.
    }
    // --- END IRQ and Tick Logic ---

    /** Returns a snapshot of the current state. */
    getSaveState() {
        // 1. Get the base state from the Mapper parent class
        const superState = super.getSaveState();

        // 2. Combine with MMC3 specific registers and state
        return {
            ...superState,
            // Bank Switching State
            prgBankMode: this._prgBankMode,
            chrBankMode: this._chrBankMode,
            registerSelect: this._registerSelect,
            registers: Array.from(this._registers), // Uint8Array must be converted to Array

            // IRQ State
            irqLatch: this._irqLatch,
            irqCounter: this._irqCounter,
            irqEnabled: this._irqEnabled,
            irqReloadPending: this._irqReloadPending,
            lastChrA12: this._lastChrA12,
        };
    }

    /** Restores state from a snapshot. */
    setSaveState(saveState) {
        // 1. Restore the base state
        super.setSaveState(saveState);

        // 2. Restore MMC3 specific registers and state
        this._prgBankMode = saveState.prgBankMode;
        this._chrBankMode = saveState.chrBankMode;
        this._registerSelect = saveState.registerSelect;
        this._registers = new Uint8Array(saveState.registers); // Restore Uint8Array

        this._irqLatch = saveState.irqLatch;
        this._irqCounter = saveState.irqCounter;
        this._irqEnabled = saveState.irqEnabled;
        this._irqReloadPending = saveState.irqReloadPending;
        this._lastChrA12 = saveState.lastChrA12;

        // NOTE: A real implementation would need to call a 'remap' function here
        // to ensure the internal bank pointers are updated after restoring the state.
    }
}
