import AudioRegisters from './AudioRegisters'
import PulseChannel from './PulseChannel'
import TriangleOscillator from '../lib/apu/TriangleOscillator'
import byte from '../lib/byte.js'
import LengthCounter from './LengthCounter'
import NoiseChannel from './NoiseChannel'
import DMCChannel from './DMCChannel'


class FrameSequencer {
    constructor(apu) {
        this.apu = apu
        this.reset()
    }
    reset() {
        this.counter = 0
    }
    step() {
        this.counter++
        const is5step = this.apu.registers.apuFrameCounter.use5StepSequencer == 1
        if (this.counter == 3729 || this.counter == 7457 || this.counter == 11186 || (!is5step && this.counter == 14916) || (is5step && this.counter == 18641)) {
            this.apu.onQuarterFrameClock()
        }

        if (this.counter == 7457 || (!is5step && this.counter == 14916) || (is5step && this.counter == 18641)) {
            this.apu.onHalfFrameClock()
        }

        if ((!is5step && this.counter == 14916) || (is5step && this.counter == 18641)) {
            this.reset()
        }
    }
}

class LinearLengthCounter extends LengthCounter {
    constructor() {
        super()
        this.reload = 0
        this.reloadFlag = false
    }

    fullReset() {
        this.reset()
        this.reload = 0
        this.reloadFlag = false
    }

    clock(isEnabled, isHalted) {
        if (!isEnabled) {
            this.reset()
            return
        }
        if (this.reloadFlag) {
            this.counter = this.reload
        }
        else {
            super.clock(isEnabled, false)
        }

        if (!isHalted) {
            this.reloadFlag = false
        }
    }
}

class TriangleChannel {
    constructor(apu) {
        this.apu = apu
        this.registers = this.apu.registers.triangle;
        this.oscillator = new TriangleOscillator()
        this.lengthCounter = new LengthCounter()
        this.prevSample = 0
        this.linearLengthCounter = new LinearLengthCounter()
    }

    sample() {

        if (!this.linearLengthCounter.isActive() || !this.isEnabled() || !this.lengthCounter.isActive()) {
            return this.prevSample
        }

        const timer = byte.buildU16(this.registers.timerHighLCL.timerHigh, this.registers.timerLow.value)

        if (timer < 2 || timer > 0x7ff) {
            return 0
        }
        this.oscillator.frequency = 1789773 / (16 * (timer + 1)) / 2;
        return this.prevSample = this.oscillator.sample()
    }

    quarterFrame() {
        this.linearLengthCounter.clock(this.isEnabled(), this.registers.lengthControl.halt)
    }

    halfFrame() {
        this.lengthCounter.clock(this.isEnabled(), this.registers.lengthControl.halt)
    }

    isEnabled() {
        return !!this.apu.registers.apuControl.enableTriangle
    }

}


export default class APU {
    constructor(cpu) {
        this.cpu = cpu;

        this.sampleCounter = 0;
        this.sample = 0;

        this.registers = new AudioRegisters(this)
        this.channels = {
            pulses: [
                new PulseChannel(this, 0, "enablePulse1"),
                new PulseChannel(this, 1, "enablePulse2")
            ],
            triangle: new TriangleChannel(this),
            noise: new NoiseChannel(this),
            dmc: new DMCChannel(this, this.cpu)
        }

        this.frameSequencer = new FrameSequencer(this)

    }

    onQuarterFrameClock() {
        this.channels.pulses[0].quarterFrame()
        this.channels.pulses[1].quarterFrame()
        this.channels.triangle.quarterFrame()
        this.channels.noise.quarterFrame()
    }

    onHalfFrameClock() {
        this.channels.pulses[0].halfFrame()
        this.channels.pulses[1].halfFrame()
        this.channels.triangle.halfFrame()
        this.channels.noise.halfFrame()
    }


    step(onSample) {

        this.channels.pulses[0].step()
        this.channels.pulses[1].step()
        this.channels.noise.step()
        this.channels.dmc.step()

        this.sampleCounter++

        this.frameSequencer.step()

        if (this.sampleCounter == 20) {
            this.sampleCounter = 0

            // <test>
            const pulse1 = this.channels.pulses[0].sample();
            const pulse2 = this.channels.pulses[1].sample();
            const triangle = this.channels.triangle.sample();
            const noise = this.channels.noise.sample();
            const dmc = this.channels.dmc.sample();
            this.sample = (
                0.00752 * (pulse1 + pulse2) +
                0.00851 * triangle +
                0.00494 * noise +
                0.00335 * dmc
            )

            // </test>

            onSample(this.sample, pulse1, pulse2, triangle, noise, dmc)
        }
    }
}
