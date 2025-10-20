import LengthCounter from "./LengthCounter";
import noisePeriods from '../lib/apu/noisePeriods'
import VolumeEnvelope from './VolumeEnvelope'

export default class NoiseChannel {
    constructor(apu) {
        this.apu = apu;

        this.shift = 1
        this.dividerCount = 0

        this.registers = this.apu.registers.noise;

        this.lengthCounter = new LengthCounter();
        this.volumeEnvelope = new VolumeEnvelope()
    }

    sample(value) {
        if (!this.isEnabled() || !this.lengthCounter.isActive() || (this.shift & 1)) return 0;

        const volume = this.registers.control.constantVolume == 1 ? this.registers.control.volumeOrEnvelopePeriod : this.volumeEnvelope.volume

        return volume;
    }

    step() {
        this.dividerCount++
        if (this.dividerCount >= noisePeriods[this.registers.form.periodId]) {
            this.dividerCount = 0
        }
        else {
            return
        }

        const modeFlag = this.registers.form.mode;
        let feedbackBit;

        if (modeFlag == 1) {
            feedbackBit = (this.shift & 1) ^ ((this.shift >> 6) & 1);
        }
        else {
            feedbackBit = (this.shift & 1) ^ ((this.shift >> 1) & 1);
        }

        this.shift >>= 1;

        this.shift |= (feedbackBit << 14);
    }

    quarterFrame() {
        this.volumeEnvelope.clock(this.registers.control.volumeOrEnvelopePeriod, this.registers.control.envelopeLoopOrLengthCounterHalt)
    }

    halfFrame() {
        this.lengthCounter.clock(
            this.isEnabled(),
            this.registers.control.envelopeLoopOrLengthCounterHalt
        );
    }

    isEnabled() {
        return !!this.apu.registers.apuControl.enableNoise;
    }

    random() {
        if (this.s == null) this.s = 0x9e3779b9;
        this.s = (this.s * 1664525 + 1013904223) >>> 0;
        return this.s / 4294967296;
    }
}
