# NES Emulator

A simple NES emulator built with JavaScript and a React + Vite + TypeScript frontend.

## Run

Install dependencies:

```bash
npm i
```

```bash
npm run dev 
```

## Robo-Ninja Climb Game hack

This will make your players health points to be always 2.
Uncommand below line in CPUMemory.js in src/emulator in write(..) function.

```bash
// if (address == 0x04A2) return this.ram[address] = 2
```
