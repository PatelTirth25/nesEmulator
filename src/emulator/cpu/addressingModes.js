import byte from "../lib/byte";

const unsupported = () => { throw new Error("Unsupported.") };
function read(cpu, argument, hasPageCrossPenalty) {
    return cpu.memory.read(this.getAddress(cpu, argument, hasPageCrossPenalty));
}

const addressingModes = {
    IMPLICIT: {
        inputSize: 0,
        getAddress: () => null,
        getValue: unsupported
    },

    IMMEDIATE: {
        inputSize: 1,
        getAddress: unsupported,
        getValue: (cpu, value) => value
    },

    ABSOLUTE: {
        inputSize: 2,
        getAddress: (cpu, address) => address,
        getValue: read
    },

    ZERO_PAGE: {
        inputSize: 1,
        getAddress: (cpu, zeroPageAddress) => zeroPageAddress,
        getValue: read
    },

    RELATIVE: {
        inputSize: 1,
        getAddress: (cpu, offset, hasPageCrossPenalty) => {
            const val = byte.toU16(cpu.pc.getValue() + byte.toS8(offset))
            if (hasPageCrossPenalty && (byte.highByteOf(val) != byte.highByteOf(cpu.pc.getValue())))
                cpu.extraCycles += 2;

            return val;
        },
        getValue: unsupported
    },

    INDIRECT: {
        inputSize: 2,
        getAddress: (cpu, absoluteAddress) => {
            if (byte.lowByteOf(absoluteAddress) === 0xff) {
                const lowbyte = cpu.memory.read(absoluteAddress)
                const highbyte = cpu.memory.read(byte.buildU16(byte.highByteOf(absoluteAddress), 0x00))
                return byte.buildU16(highbyte, lowbyte)
            }
            else {
                return cpu.memory.read16(absoluteAddress)
            }
        },
        getValue: unsupported
    },

    INDEXED_ZERO_PAGE_X: {
        inputSize: 1,
        getAddress: (cpu, zeroPageAddress) => {
            return byte.toU8(cpu.x.getValue() + zeroPageAddress);
        },
        getValue: read
    },

    INDEXED_ZERO_PAGE_Y: {
        inputSize: 1,
        getAddress: (cpu, zeroPageAddress) => {
            return byte.toU8(cpu.y.getValue() + zeroPageAddress);
        },
        getValue: read
    },

    INDEXED_ABSOLUTE_X: {
        inputSize: 2,
        getAddress: (cpu, absoluteAddress, hasPageCrossPenalty) => {
            const val = byte.toU16(cpu.x.getValue() + absoluteAddress)
            if (hasPageCrossPenalty && (byte.highByteOf(val) != byte.highByteOf(absoluteAddress)))
                cpu.extraCycles += 1
            return val
        },
        getValue: read
    },

    INDEXED_ABSOLUTE_Y: {
        inputSize: 2,
        getAddress: (cpu, absoluteAddress, hasPageCrossPenalty) => {
            const val = byte.toU16(cpu.y.getValue() + absoluteAddress)
            if (hasPageCrossPenalty && (byte.highByteOf(val) != byte.highByteOf(absoluteAddress)))
                cpu.extraCycles += 1
            return val
        },
        getValue: read
    },

    INDEXED_INDIRECT: {
        inputSize: 1,
        getAddress: (cpu, zeroPageAddress) => {
            const start = byte.toU8(zeroPageAddress + cpu.x.getValue())
            const end = byte.toU8(start + 1)
            return byte.buildU16(cpu.memory.read(end), cpu.memory.read(start))
        },
        getValue: read
    },

    INDIRECT_INDEXED: {
        inputSize: 1,
        getAddress: (cpu, zeroPageAddress, hasPageCrossPenalty) => {
            const start = zeroPageAddress;
            const end = byte.toU8(start + 1)
            const baseAddr = byte.buildU16(cpu.memory.read(end), cpu.memory.read(start))
            const output = byte.toU16(baseAddr + cpu.y.getValue())
            if (hasPageCrossPenalty && (byte.highByteOf(output) != byte.highByteOf(baseAddr)))
                cpu.extraCycles += 1
            return output;
        },
        getValue: read
    },
};

for (let key in addressingModes) {
    addressingModes[key].id = key;
}

export default addressingModes;
