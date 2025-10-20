import DPCM from '../lib/apu/DPCM'

export default class DMCChannel {
    constructor(apu, cpu) {
        this.apu = apu;
        this.cpu = cpu;
        this.dpcm = new DPCM(this)

        this.registers = this.apu.registers.dmc;

        this.outputSample = 0;
    }

    sample() {
        return this.outputSample;
    }

    step() {
        this.dpcm.update()
    }
}
