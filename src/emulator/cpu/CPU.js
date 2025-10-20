import byte from '../lib/byte.js'
import defineOperations from '../lib/cpu/defineOperations.js'
import instructions from './instructions.js'
import addressingModes from './addressingModes.js'

class Register8Bit {
    constructor() {
        this.register = new Uint8Array(1)
    }
    getValue() {
        return this.register[0]
    }
    setValue(value) {
        this.register[0] = value
    }
    increment() {
        this.setValue(this.getValue() + 1);
    }
    decrement() {
        this.setValue(this.getValue() - 1);
    }
}

class Register16Bit {
    constructor() {
        this.register = new Uint16Array(1)
    }
    getValue() {
        return this.register[0]
    }
    setValue(value) {
        this.register[0] = value
    }
    increment() {
        this.setValue(this.getValue() + 1);
    }
    decrement() {
        this.setValue(this.getValue() - 1);
    }
}

class FlagsRegister {
    constructor() {
        this.c = false;
        this.z = false;
        this.i = false;
        this.d = false;
        this.v = false;
        this.n = false;
    }
    getValue() {
        return byte.bitfield(this.c, this.z, this.i, this.d, 0, 1, this.v, this.n);
    }
    setValue(value) {
        this.c = byte.getFlag(value, 0);
        this.z = byte.getFlag(value, 1);
        this.i = byte.getFlag(value, 2);
        this.d = byte.getFlag(value, 3);
        this.v = byte.getFlag(value, 6);
        this.n = byte.getFlag(value, 7);
    }
    updateZero(value) {
        this.z = value == 0;
    }
    updateNegative(value) {
        this.n = byte.isNegative(value);
    }
    updateZeroAndNegative(value) {
        this.updateZero(value)
        this.updateNegative(value)
    }
}

class Stack {
    constructor(memory, sp) {
        this.sp = sp
        this.memory = memory
        this.currentAddress = 0x0100
    }

    push(value) {
        let spval = this.sp.getValue();
        const address = this.currentAddress + spval;
        this.memory.write(address, value);
        this.sp.decrement();
    }

    pop() {
        this.sp.increment();
        let spval = this.sp.getValue();
        const address = this.currentAddress + spval;
        return this.memory.read(address);
    }

    push16(bigNumber) {
        let lowbyte = byte.lowByteOf(bigNumber);
        let highbyte = byte.highByteOf(bigNumber);
        this.push(highbyte);
        this.push(lowbyte);
    }

    pop16() {
        let lowbyte = this.pop();
        let highbyte = this.pop();
        return byte.buildU16(highbyte, lowbyte);
    }

}

export default class CPU {
    constructor(cpuMemory) {
        this.memory = cpuMemory;
        this.cycle = 0;
        this.extraCycles = 0;

        this.a = new Register8Bit();
        this.x = new Register8Bit();
        this.y = new Register8Bit();
        this.sp = new Register8Bit();
        this.pc = new Register16Bit();

        this.flags = new FlagsRegister();

        this.stack = new Stack(this.memory, this.sp);

        this.operations = defineOperations(instructions, addressingModes);
    }

    _fetchOperation() {
        const opcode = this.memory.read(this.pc.getValue())
        const operation = this.operations[opcode]
        if (operation == null)
            throw new Error("Invalid opcode.")

        this.pc.increment()
        return operation
    }

    _fetchInput(operation) {
        const size = operation.addressingMode.inputSize
        let input = null;
        if (size == 2) {
            input = this.memory.read16(this.pc.getValue());
            this.pc.increment();
            this.pc.increment();
        }
        else if (size == 1) {
            input = this.memory.read(this.pc.getValue());
            this.pc.increment()
        }

        return input
    }

    _fetchArgument(operation, input) {
        if (operation.instruction.argument === "value")
            return operation.addressingMode.getValue(this, input, operation.hasPageCrossPenalty)
        else
            return operation.addressingMode.getAddress(this, input, operation.hasPageCrossPenalty)
    }

    _addCycles(operation) {
        const cycles = operation.cycles + this.extraCycles
        this.cycle += cycles;
        this.extraCycles = 0;
        return cycles;
    }

    step() {
        const originalPC = this.pc.getValue();

        const operation = this._fetchOperation();
        const input = this._fetchInput(operation);
        const argument = this._fetchArgument(operation, input);

        if (this.logger != null) {
            this.logger(
                this,
                originalPC,
                operation,
                input,
                argument
            )
        }

        operation.instruction.run(this, argument);
        return this._addCycles(operation);
    }

    interrupt(interrupt, withBFlag = false) {
        if (interrupt.id == "IRQ" && this.flags.i == true) return;

        const pcval = this.pc.getValue();
        this.stack.push16(pcval);

        let flag = this.flags.getValue() | 0b00100000;
        flag = withBFlag ? flag | 0b00010000 : flag;
        this.stack.push(flag)

        this.flags.setValue(this.flags.getValue() | 0b00000100)

        this.cycle += 7;
        this.pc.setValue(this.memory.read16(interrupt.vector));
        return 7;
    }

}
