import byte from "../lib/byte";
import PulseOscillator from '../lib/apu/PulseOscillator'
import LengthCounter from './LengthCounter'
import VolumeEnvelope from './VolumeEnvelope'

class FrequencySweep {
    constructor(channel) {
        this.channel = channel
        this.startFlag = false
        this.dividerCount = 0
        this.mute = false
    }
    clock() {

        if (this.channel.registers.sweep.enabledFlag && this.channel.registers.sweep.shiftCount > 0
            && this.dividerCount == 0 && !this.mute) {
            const sweepDelta = this.channel.timer >> this.channel.registers.sweep.shiftCount;
            this.channel.timer += sweepDelta * (this.channel.registers.sweep.negateFlag ? -1 : 1);
        }

        if (this.dividerCount == 0 || this.startFlag) {
            this.dividerCount = this.channel.registers.sweep.dividerPeriodMinusOne + 1
            this.startFlag = false
        }
        else {
            this.dividerCount--
        }

    }

    muteIfNeeded() {
        this.mute = this.channel.timer < 8 || this.channel.timer > 0x7ff
    }
}

export default class PulseChannel {
    constructor(apu, id, enableFlagName) {
        this.apu = apu;

        this.id = id;
        this.enableFlagName = enableFlagName;

        this.timer = 0;
        this.registers = this.apu.registers.pulses[this.id];

        this.oscillator = new PulseOscillator();
        this.lengthCounter = new LengthCounter()

        this.prevSample = 0
        this.volumeEnvelope = new VolumeEnvelope()

        this.frequencySweep = new FrequencySweep(this)
    }

    sample() {
        if (!this.isEnabled() || this.frequencySweep.mute || !this.lengthCounter.isActive()) {
            return this.prevSample
        }

        this.oscillator.frequency = 1789773 / (16 * (this.timer + 1))
        this.oscillator.dutyCycle = this.registers.control.dutyCycleId
        this.oscillator.volume = this.registers.control.constantVolume == 1 ? this.registers.control.volumeOrEnvelopePeriod : this.volumeEnvelope.volume
        return this.prevSample = this.oscillator.sample();
    }

    quarterFrame() {
        this.volumeEnvelope.clock(this.registers.control.volumeOrEnvelopePeriod, this.registers.control.envelopeLoopOrLengthCounterHalt)
    }

    halfFrame() {
        this.lengthCounter.clock(this.isEnabled(), this.registers.control.envelopeLoopOrLengthCounterHalt)
        this.frequencySweep.clock()
    }

    updateTimer() {
        this.timer = byte.buildU16(
            this.registers.timerHighLCL.timerHigh,
            this.registers.timerLow.value
        );
    }

    step() {
        this.frequencySweep.muteIfNeeded()
        if (!this.registers.sweep.enabledFlag)
            this.updateTimer();
    }

    isEnabled() {
        return !!this.apu.registers.apuControl[this.enableFlagName];
    }
}
