import byte from './lib/byte.js'

export default class CPUMemory {
    constructor() {
        this.ram = new Uint8Array(2048);
    }

    read(address) {
        // 🐏 WRAM (2 KiB)
        if (address >= 0x0000 && address <= 0x07ff)
            return this.ram[address];


        // 🚽 Mirrors of $0000-$07FF
        if (address >= 0x0800 && address <= 0x1fff)
            return this.read(0x0000 + (address - 0x0800) % 0x0800);

        // 🖥️ PPU registers
        if (address >= 0x2000 && address <= 0x2007)
            return this.ppu.registers.read(address)

        // 🚽 Mirrors of $2000-2007
        if (address >= 0x2008 && address <= 0x3fff)
            return this.read(0x2000 + (address - 0x2008) % 0x0008);

        // 🔊 APU registers (Pulse, Triangle, Noise, DMC length/period)
        if (address >= 0x4000 && address <= 0x4013)
            return this.apu.registers.read(address)

        // 🖥️ PPU's OAMDMA register (Write-only, but sometimes read returns $2004)
        if (address == 0x4014)
            return this.ppu.registers.read(address)

        // 🔊 APU Status register (Read only: $4015)
        if (address == 0x4015)
            return this.apu.registers.read(address)

        // 🎮 Controller port 1 (Read: $4016)
        if (address == 0x4016)
            return this.controllers[0].onRead();

        // 🎮 Controller port 2 (Read: $4017)
        if (address == 0x4017)
            return this.controllers[1].onRead();

        // 💾 Cartridge space (PRG-ROM, mapper, etc.)
        if (address >= 0x4020 && address <= 0xFFFF)
            return this.mapper.cpuRead(address);


        return 0;
    }

    read16(address) {
        let lowbyte = this.read(address);
        let highbyte = this.read(address + 1);
        return byte.buildU16(highbyte, lowbyte);
    }

    write(address, value) {

        // Robo-Ninja Game Hack ( makes players life to be constant 2 )
        // if (address == 0x04A2) return this.ram[address] = 2

        // 🐏 WRAM (2 KiB)
        if (address >= 0x0000 && address <= 0x07ff)
            this.ram[address] = value;

        // 🚽 Mirrors of $0000-$07FF
        if (address >= 0x0800 && address <= 0x1fff)
            return this.write(0x0000 + (address - 0x0800) % 0x0800, value);

        // 🖥️ PPU registers
        if (address >= 0x2000 && address <= 0x2007)
            this.ppu.registers.write(address, value)

        // 🚽 Mirrors of $2000-2007
        if (address >= 0x2008 && address <= 0x3fff)
            return this.write(0x2000 + (address - 0x2008) % 0x0008, value);

        // 🔊 APU registers
        if (address >= 0x4000 && address <= 0x4013)
            return this.apu.registers.write(address, value)

        // 🖥️ PPU's OAMDMA register (Write: $4014)
        if (address == 0x4014)
            this.ppu.registers.write(address, value)

        // 🔊 APU Control ($4015) or APU Frame Counter ($4017)
        if (address == 0x4015 || address == 0x4017)
            return this.apu.registers.write(address, value)

        // 🎮 Controller port 1/2 Strobe (Write: $4016)
        if (address == 0x4016) {
            this.controllers[0].onWrite(value);
            this.controllers[1].onWrite(value);
            return; // Stop processing, the write is complete
        }
        // 💾 Cartridge space (PRG-ROM, mapper, etc.)
        if (address >= 0x4020 && address <= 0xFFFF)
            return this.mapper.cpuWrite(address, value);

    }


    onLoad(ppu, apu, mapper, controllers) {
        this.ppu = ppu;
        this.apu = apu;
        this.mapper = mapper;
        this.controllers = controllers;
    }
}
