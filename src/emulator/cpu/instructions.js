import byte from "../lib/byte";
import interrupts from "../lib/interrupts";

const instructions = {
    // Increment X Register
    INX: {
        argument: "no",
        run(cpu) {
            // Increments [X], updating the Z and N flags.
            cpu.x.increment();
            cpu.flags.updateZeroAndNegative(cpu.x.getValue());
        },
    },

    // Increment Y Register
    INY: {
        argument: "no",
        run(cpu) {
            // Increments [Y], updating the Z and N flags.
            cpu.y.increment();
            cpu.flags.updateZeroAndNegative(cpu.y.getValue());
        },
    },

    // Increment Memory
    INC: {
        argument: "address",
        run(cpu, addr) {
            // Adds one to the value held at <addr>, updating the Z and N flags.
            const value = cpu.memory.read(addr);
            const newValue = byte.toU8(value + 1);
            cpu.memory.write(addr, newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },

    // Decrement Y Register
    DEY: {
        argument: "no",
        run(cpu) {
            cpu.y.decrement();
            cpu.flags.updateZeroAndNegative(cpu.y.getValue());
        },
    },

    // Decrement X Register
    DEX: {
        argument: "no",
        run(cpu) {
            cpu.x.decrement();
            cpu.flags.updateZeroAndNegative(cpu.x.getValue());
        },
    },

    // Decrement Memory
    DEC: {
        argument: "address",
        run(cpu, addr) {
            // Adds one to the value held at <addr>, updating the Z and N flags.
            const value = cpu.memory.read(addr);
            const newValue = byte.toU8(value - 1);
            cpu.memory.write(addr, newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },

    // Add with Carry
    ADC: {
        argument: "value",
        run(cpu, val) {
            // Adds the contents of <val> to [A] together with the Carry Flag
            // ([A] = [A] + <val> + C), updating the Z and N flags.
            const oldValue = cpu.a.getValue();
            const result = oldValue + val + cpu.flags.c;
            const newValue = byte.toU8(result);
            cpu.a.setValue(newValue);
            cpu.flags.updateZeroAndNegative(newValue);

            // C and V flags are set in case of unsigned and signed overflow respectively.
            // Unsigned overflow occurs when the result is >= `256` (use `byte.overflows(...)`)
            // Signed overflow occurs when `Positive + Positive = Negative` or `Negative + Negative = Positive`
            cpu.flags.c = byte.overflows(result);
            cpu.flags.v =
                (byte.isPositive(oldValue) &&
                    byte.isPositive(val) &&
                    byte.isNegative(newValue)) ||
                (byte.isNegative(oldValue) &&
                    byte.isNegative(val) &&
                    byte.isPositive(newValue));
        },
    },

    // Subtract with Carry
    SBC: {
        argument: "value",
        run(cpu, value) {
            // SBC is implemented as: A = A + (Value XOR 0xFF) + C

            // 1. Calculate the one's complement (bitwise inverse) of the operand.
            // The value must be treated as an 8-bit unsigned integer before inverting.
            const invertedValue = value ^ 0xFF;

            // 2. Perform the addition, similar to ADC: A + invertedValue + C
            const oldValue = cpu.a.getValue();
            const result = oldValue + invertedValue + cpu.flags.c;

            // 3. Store the 8-bit result in A
            const newValue = byte.toU8(result);
            cpu.a.setValue(newValue);

            // 4. Update Zero (Z) and Negative (N) flags
            cpu.flags.updateZeroAndNegative(newValue);

            // 5. Update Carry (C) and Overflow (V) flags

            // C Flag: In SBC, the Carry flag is set if NO borrow occurred (A >= Value + (1-C_in)).
            // In the addition form (A + invertedValue + C), the Carry flag indicates unsigned overflow.
            // An unsigned overflow here corresponds to C=1 (no borrow) in subtraction.
            cpu.flags.c = byte.overflows(result);

            // V Flag: Signed overflow occurs when:
            // Positive - Negative = Negative (i.e., Pos + Pos = Neg in the addition form)
            // Negative - Positive = Positive (i.e., Neg + Neg = Pos in the addition form)
            // Note: The 'value' is actually 'invertedValue' in the addition formula.

            cpu.flags.v =
                // Case 1: Positive - Negative = Negative (oldValue (Pos) + invertedValue (Pos) = newValue (Neg))
                // e.g. 10 - (-120) = 130 -> Overflow
                (byte.isPositive(oldValue) &&
                    byte.isPositive(invertedValue) &&
                    byte.isNegative(newValue)) ||

                // Case 2: Negative - Positive = Positive (oldValue (Neg) + invertedValue (Neg) = newValue (Pos))
                // e.g. -10 - (120) = -130 -> Overflow
                (byte.isNegative(oldValue) &&
                    byte.isNegative(invertedValue) &&
                    byte.isPositive(newValue));
        },
    },

    // Arithmetic Shift Left
    ASL: {
        argument: "address",
        run(cpu, addr) {
            const value = cpu.memory.read(addr);
            const newValue = (value << 1) & 0xff;
            cpu.flags.c = byte.getFlag(value, 7);
            cpu.memory.write(addr, newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },

    // Arithmetic Shift Left (Accumulator)
    ASLa: {
        argument: "no",
        run(cpu) {
            const value = cpu.a.getValue();
            const newValue = (value << 1) & 0xff;
            cpu.flags.c = byte.getFlag(value, 7);
            cpu.a.setValue(newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },

    // Logical Shift Right
    LSR: {
        argument: "address",
        run(cpu, addr) {
            const value = cpu.memory.read(addr);
            const newValue = (value >> 1) & 0xff;
            cpu.flags.c = byte.getFlag(value, 0);
            cpu.memory.write(addr, newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },

    // Logical Shift Right (Accumulator)
    LSRa: {
        argument: "no",
        run(cpu) {
            const value = cpu.a.getValue();
            const newValue = (value >> 1) & 0xff;
            cpu.flags.c = byte.getFlag(value, 0);
            cpu.a.setValue(newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },

    // Rotate Left
    ROL: {
        argument: "address",
        run(cpu, addr) {
            const value = cpu.memory.read(addr);
            let newValue = (value << 1) & 0xff;

            if (cpu.flags.c == true) newValue = newValue | 1;
            cpu.flags.c = byte.getFlag(value, 7);
            cpu.memory.write(addr, newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },

    // Rotate Left (Accumulator)
    ROLa: {
        argument: "no",
        run(cpu) {
            const value = cpu.a.getValue();
            let newValue = (value << 1) & 0xff;

            if (cpu.flags.c == true) newValue = newValue | 1;
            cpu.flags.c = byte.getFlag(value, 7);
            cpu.a.setValue(newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },

    // Rotate Right
    ROR: {
        argument: "address",
        run(cpu, addr) {
            const value = cpu.memory.read(addr);
            let newValue = (value >> 1) & 0xff;

            if (cpu.flags.c == true) newValue = newValue | 0b10000000;
            cpu.flags.c = byte.getFlag(value, 0);
            cpu.memory.write(addr, newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },

    // Rotate Right (Accumulator)
    RORa: {
        argument: "no",
        run(cpu) {
            const value = cpu.a.getValue();
            let newValue = (value >> 1) & 0xff;

            if (cpu.flags.c == true) newValue = newValue | 0b10000000;
            cpu.flags.c = byte.getFlag(value, 0);
            cpu.a.setValue(newValue);
            cpu.flags.updateZeroAndNegative(newValue);
        },
    },


    // DATA Instructions
    CLC: {
        argument: "no",
        run(cpu) {
            cpu.flags.c = false;
        }
    },

    CLD: {
        argument: "no",
        run(cpu) {
            cpu.flags.d = false;
        }
    },

    CLI: {
        argument: "no",
        run(cpu) {
            cpu.flags.i = false;
        }
    },

    CLV: {
        argument: "no",
        run(cpu) {
            cpu.flags.v = false;
        }
    },

    SEC: {
        argument: "no",
        run(cpu) {
            cpu.flags.c = true;
        }
    },

    SED: {
        argument: "no",
        run(cpu) {
            cpu.flags.d = true;
        }
    },

    SEI: {
        argument: "no",
        run(cpu) {
            cpu.flags.i = true;
        }
    },

    LDA: {
        argument: "value",
        run(cpu, val) {
            cpu.a.setValue(val);
            cpu.flags.updateZeroAndNegative(val);
        }
    },

    LDX: {
        argument: "value",
        run(cpu, val) {
            cpu.x.setValue(val);
            cpu.flags.updateZeroAndNegative(val);
        }
    },

    LDY: {
        argument: "value",
        run(cpu, val) {
            cpu.y.setValue(val);
            cpu.flags.updateZeroAndNegative(val);
        }
    },

    PHA: {
        argument: "no",
        run(cpu) {
            const val = cpu.a.getValue();
            cpu.stack.push(val);
        }
    },

    PHP: {
        argument: "no",
        run(cpu) {
            let val = cpu.flags.getValue();
            val = byte.setBit(val, 4, 1);
            cpu.stack.push(val);
        }
    },

    PLA: {
        argument: "no",
        run(cpu) {
            const val = cpu.stack.pop();
            cpu.a.setValue(val);
            cpu.flags.updateZeroAndNegative(val);
        }
    },

    PLP: {
        argument: "no",
        run(cpu) {
            let val = cpu.stack.pop();
            cpu.flags.setValue(val);
        }
    },

    STA: {
        argument: "address",
        run(cpu, addr) {
            const val = cpu.a.getValue();
            cpu.memory.write(addr, val);
        }
    },

    STX: {
        argument: "address",
        run(cpu, addr) {
            const val = cpu.x.getValue();
            cpu.memory.write(addr, val);
        }
    },

    STY: {
        argument: "address",
        run(cpu, addr) {
            const val = cpu.y.getValue();
            cpu.memory.write(addr, val);
        }
    },

    TAX: {
        argument: "no",
        run(cpu) {
            const val = cpu.a.getValue();
            cpu.x.setValue(val);
            cpu.flags.updateZeroAndNegative(val);
        }
    },

    TAY: {
        argument: "no",
        run(cpu) {
            const val = cpu.a.getValue();
            cpu.y.setValue(val);
            cpu.flags.updateZeroAndNegative(val);
        }
    },

    TSX: {
        argument: "no",
        run(cpu) {
            const val = cpu.sp.getValue();
            cpu.x.setValue(val);
            cpu.flags.updateZeroAndNegative(val);
        }
    },

    TXA: {
        argument: "no",
        run(cpu) {
            const val = cpu.x.getValue();
            cpu.a.setValue(val);
            cpu.flags.updateZeroAndNegative(val);
        }
    },

    TYA: {
        argument: "no",
        run(cpu) {
            const val = cpu.y.getValue();
            cpu.a.setValue(val);
            cpu.flags.updateZeroAndNegative(val);
        }
    },

    TXS: {
        argument: "no",
        run(cpu) {
            const val = cpu.x.getValue();
            cpu.sp.setValue(val);
        }
    },

    BIT: {
        argument: "value",
        run(cpu, val) {
            cpu.flags.z = (val & cpu.a.getValue()) == 0x00;
            cpu.flags.n = byte.getFlag(val, 7);
            cpu.flags.v = byte.getFlag(val, 6);
        }
    },

    CMP: {
        argument: "value",
        run(cpu, val) {
            cpu.flags.z = val == cpu.a.getValue();
            cpu.flags.n = byte.getFlag(cpu.a.getValue() - val, 7);
            cpu.flags.c = val <= cpu.a.getValue();
        }
    },

    CPX: {
        argument: "value",
        run(cpu, val) {
            cpu.flags.z = val == cpu.x.getValue();
            cpu.flags.n = byte.getFlag(cpu.x.getValue() - val, 7);
            cpu.flags.c = val <= cpu.x.getValue();
        }
    },

    CPY: {
        argument: "value",
        run(cpu, val) {
            cpu.flags.z = val == cpu.y.getValue();
            cpu.flags.n = byte.getFlag(cpu.y.getValue() - val, 7);
            cpu.flags.c = val <= cpu.y.getValue();
        }
    },

    AND: {
        argument: "value",
        run(cpu, val) {
            const res = val & cpu.a.getValue();
            cpu.a.setValue(res);
            cpu.flags.updateZeroAndNegative(res);
        }
    },

    EOR: {
        argument: "value",
        run(cpu, val) {
            const res = val ^ cpu.a.getValue();
            cpu.a.setValue(res);
            cpu.flags.updateZeroAndNegative(res);
        }
    },

    ORA: {
        argument: "value",
        run(cpu, val) {
            const res = val | cpu.a.getValue();
            cpu.a.setValue(res);
            cpu.flags.updateZeroAndNegative(res);
        }
    },

    BCC: {
        argument: "address",
        run(cpu, addr) {
            if (cpu.flags.c == false) {
                cpu.extraCycles += 1;
                cpu.pc.setValue(addr);
            }
            else {
                cpu.extraCycles = 0;
            }
        }
    },

    BNE: {
        argument: "address",
        run(cpu, addr) {
            if (cpu.flags.z == false) {
                cpu.extraCycles += 1;
                cpu.pc.setValue(addr);
            }
            else {
                cpu.extraCycles = 0;
            }
        }
    },

    BCS: {
        argument: "address",
        run(cpu, addr) {
            if (cpu.flags.c == true) {
                cpu.extraCycles += 1;
                cpu.pc.setValue(addr);
            }
            else {
                cpu.extraCycles = 0;
            }
        }
    },

    BEQ: {
        argument: "address",
        run(cpu, addr) {
            if (cpu.flags.z == true) {
                cpu.extraCycles += 1;
                cpu.pc.setValue(addr);
            }
            else {
                cpu.extraCycles = 0;
            }
        }
    },

    BMI: {
        argument: "address",
        run(cpu, addr) {
            if (cpu.flags.n == true) {
                cpu.extraCycles += 1;
                cpu.pc.setValue(addr);
            }
            else {
                cpu.extraCycles = 0;
            }
        }
    },

    BPL: {
        argument: "address",
        run(cpu, addr) {
            if (cpu.flags.n == false) {
                cpu.extraCycles += 1;
                cpu.pc.setValue(addr);
            }
            else {
                cpu.extraCycles = 0;
            }
        }
    },

    BVC: {
        argument: "address",
        run(cpu, addr) {
            if (cpu.flags.v == false) {
                cpu.extraCycles += 1;
                cpu.pc.setValue(addr);
            }
            else {
                cpu.extraCycles = 0;
            }
        }
    },

    BVS: {
        argument: "address",
        run(cpu, addr) {
            if (cpu.flags.v == true) {
                cpu.extraCycles += 1;
                cpu.pc.setValue(addr);
            }
            else {
                cpu.extraCycles = 0;
            }
        }
    },

    JMP: {
        argument: "address",
        run(cpu, addr) {
            cpu.pc.setValue(addr);
        }
    },

    JSR: {
        argument: "address",
        run(cpu, addr) {
            cpu.pc.decrement()
            cpu.stack.push16(cpu.pc.getValue())
            cpu.pc.setValue(addr);
        }
    },

    RTI: {
        argument: "no",
        run(cpu) {
            const flag = cpu.stack.pop();
            const val = cpu.stack.pop16();
            cpu.flags.setValue(flag);
            cpu.pc.setValue(val);
        }
    },

    RTS: {
        argument: "no",
        run(cpu) {
            const val = cpu.stack.pop16();
            cpu.pc.setValue(val + 1);
        }
    },

    BRK: {
        argument: "no",
        run(cpu) {
            cpu.interrupt(interrupts.IRQ, true)
        }
    },

    NOP: {
        argument: "no",
        run() { }
    },


};

for (let key in instructions) {
    instructions[key].id = key;
}

export default instructions;
