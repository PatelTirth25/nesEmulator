# NES Emulator

A simple NES emulator built with JavaScript and a React + Vite + TypeScript frontend.

## Run

```bash
git clone https://github.com/PatelTirth25/nesEmulator
```

```bash
cd nesEmulator 
```

```bash
npm i
```

```bash
npm run dev 
```

## Roms

There are few roms available in below directory:

```bash
nesEmulator/src/emulator/roms/
```

Not all games are supported.

## Robo-Ninja Climb Game hack

This will make your players health points to be always 2.
Uncommand below line in CPUMemory.js in src/emulator in write(..) function.

```bash
// if (address == 0x04A2) return this.ram[address] = 2
```
