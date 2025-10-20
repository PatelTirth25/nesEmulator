import PPUMemory from './PPUMemory'
import byte from '../lib/byte.js'
import VideoRegisters from './VideoRegisters'
import interrupts from '../lib/interrupts'
import masterPalette from '../lib/ppu/masterPalette'
import Sprite from '../lib/ppu/Sprite'
import LoopyRegister from '../lib/ppu/LoopyRegister'

class Tile {
    constructor(ppu, patternTableId, tileId, y) {
        const tableAddress = patternTableId == 0 ? 0x0000 : 0x1000
        const lowplaneaddr = tableAddress + tileId * 16
        const highplaneaddr = lowplaneaddr + 8;
        this._lowRow = ppu.memory.read(lowplaneaddr + y)
        this._highRow = ppu.memory.read(highplaneaddr + y)

    }
    getColorIndex(x) {
        x = 7 - x;
        return byte.buildU2(byte.getBit(this._highRow, x), byte.getBit(this._lowRow, x))
    }
}

class BackgroundRenderer {
    constructor(ppu) {
        this.ppu = ppu
    }

    renderScanline() {
        const y = this.ppu.scanline;
        for (let x = 0; x < 256;) {

            const scrolledX = this.ppu.loopy.scrolledX(x);
            const scrolledY = this.ppu.loopy.scrolledY(y);

            const nameTableId = this.ppu.loopy.nameTableId(scrolledX);

            const nameTableAddress = 0x2000 + nameTableId * 1024;

            const nameTableX = scrolledX % 256;
            const nameTableY = scrolledY % 240;

            const tileX = Math.floor(nameTableX / 8);
            const tileY = Math.floor(nameTableY / 8);

            const tileOffset = tileY * 32 + tileX;

            const tileIdAddress = nameTableAddress + tileOffset;
            const tileId = this.ppu.memory.read(tileIdAddress);

            const patternTableId = this.ppu.registers.ppuCtrl.backgroundPatternTableId == 1 ? 0x1000 : 0x0000;

            const tileStartX = nameTableX % 8;
            const tileInsideY = nameTableY % 8;
            const tilePixels = Math.min(
                8 - tileStartX,
                256 - nameTableX
            )

            const paletteId = this._getBackgroundPaletteId(nameTableId, nameTableX, nameTableY);

            const tile = new Tile(this.ppu, patternTableId, tileId, tileInsideY);

            const showBackground = this.ppu.registers.ppuMask.showBackground;
            const showBackgroundInFirst8Pixels = this.ppu.registers.ppuMask.showBackgroundInFirst8Pixels;

            // Check if the current chunk of pixels needs to be masked off
            if (showBackground == false || (showBackgroundInFirst8Pixels == false && x < 8)) {
                for (let xx = 0; xx < tilePixels; xx++) {
                    const color = this.ppu.getColor(0, 0); // Backdrop color
                    const colorIndex = 0;

                    // Only plot for pixels that are truly masked within this tile chunk
                    if (showBackground == false || (showBackgroundInFirst8Pixels == false && (x + xx) < 8)) {
                        this.ppu.plotBG(x + xx, y, color, colorIndex);
                    } else {
                        const calculatedColorIndex = tile.getColorIndex(tileStartX + xx);
                        const calculatedColor = this.ppu.getColor(0, 0);

                        this.ppu.plotBG(x + xx, y, calculatedColor, calculatedColorIndex);
                    }
                }
                x += tilePixels;
                continue;
            }

            // Normal (Unmasked) Rendering Path
            for (let xx = 0; xx < tilePixels; xx++) {
                const colorIndex = tile.getColorIndex(tileStartX + xx);
                const color =
                    colorIndex > 0 ? this.ppu.getColor(paletteId, colorIndex) : this.ppu.getColor(0, 0);

                this.ppu.plotBG(x + xx, y, color, colorIndex)
            }

            x += tilePixels
        }
    }

    _getBackgroundPaletteId(nameTableId, x, y) {
        const metaBlockX = Math.floor(x / 32)
        const metaBlockY = Math.floor(y / 32)
        const metaBlockInd = metaBlockY * 8 + metaBlockX
        const startAddress = 0x2000 + nameTableId * 1024 + 960

        const block = this.ppu.memory.read(startAddress + metaBlockInd);
        const blockX = Math.floor((x % 32) / 16);
        const blockY = Math.floor((y % 32) / 16);
        const blockIndex = blockY * 2 + blockX;

        return byte.getBits(block, blockIndex * 2, 2)
    }

}

class SpriteRenderer {
    constructor(ppu) {
        this.ppu = ppu
    }

    _createSprite(id) {
        const address = id * 4;

        const yOAM = this.ppu.memory.oamRam[address + 0];     // Byte 0: Y Position
        const tileIdOAM = this.ppu.memory.oamRam[address + 1]; // Byte 1: Tile Index/ID
        const attributes = this.ppu.memory.oamRam[address + 2]; // Byte 2: Attributes/Palette
        const x = this.ppu.memory.oamRam[address + 3];       // Byte 3: X Position

        const y = yOAM + 1;

        let patternTableId;
        let topTileId;

        let is8x16 = this.ppu.registers.ppuCtrl.spriteSize; // 0 for 8x8, 1 for 8x16

        if (is8x16 === 0) { // 8x8 Sprites

            patternTableId = this.ppu.registers.ppuCtrl.sprite8x8PatternTableId;

            topTileId = tileIdOAM;

        } else { // 8x16 Sprites

            patternTableId = tileIdOAM & 0b00000001;

            topTileId = tileIdOAM & 0b11111110;
        }
        is8x16 = !!is8x16
        return new Sprite(id, x, y, is8x16, patternTableId, topTileId, attributes);
    }

    _evaluate() {
        let sprites = []
        for (let i = 0; i < 64; i++) {
            let sprite = this._createSprite(i)
            if (sprite.shouldRenderInScanline(this.ppu.scanline) && sprites.length < 9) {
                if (sprites.length < 8) {
                    sprites.push(sprite)
                }
                else {
                    this.ppu.registers.ppuStatus.spriteOverflow = 1
                    break
                }
            }
        }
        sprites.reverse()
        return sprites
    }

    renderScanline() {
        if (this.ppu.registers.ppuMask.showSprites == false) return

        const sprites = this._evaluate();
        const buffer = this._render(sprites);
        this._draw(buffer)
    }

    _draw(buffer) {
        const y = this.ppu.scanline;
        buffer.forEach((element, _) => {
            if (element) {
                const isInFront = element.sprite.isInFrontOfBackground;
                const isBGOpaque = this.ppu.isBackgroundPixelOpaque(element.x, y);
                if (isInFront || !isBGOpaque) {
                    console.log(element)
                    this.ppu.plot(element.x, y, element.paletteColors);
                }
            }
        })
    }

    _render(sprites) {
        const y = this.ppu.scanline;
        let buffer = []

        // Retrieve masking flags once per scanline
        const showSprites = this.ppu.registers.ppuMask.showSprites;
        const showSpritesInFirst8Pixels = this.ppu.registers.ppuMask.showSpritesInFirst8Pixels;
        const showBackground = this.ppu.registers.ppuMask.showBackground;

        sprites.forEach((sprite, _) => {
            const insideY = sprite.diffY(y);

            const tileInsideY = insideY % 8;
            const tileYIndex = sprite.flipY ? (7 - tileInsideY) : tileInsideY;

            const tileId = sprite.tileIdFor(insideY);

            const tile = new Tile(this.ppu, sprite.patternTableId, tileId, tileYIndex);

            for (let insideX = 0; insideX < 8; insideX++) {

                const x = sprite.x + insideX;

                if (!showSprites || (!showSpritesInFirst8Pixels && x < 8)) {
                    continue;
                }

                const tileXIndex = sprite.flipX ? (7 - insideX) : insideX;

                const colorIndex = tile.getColorIndex(tileXIndex);

                if (colorIndex > 0) {
                    const paletteColors = this.ppu.getColor(sprite.paletteId, colorIndex);

                    buffer[x] = { x, sprite, paletteColors };

                    if (sprite.id == 0 && this.ppu.isBackgroundPixelOpaque(x, y) && showSprites && showBackground) {
                        this.ppu.registers.ppuStatus.sprite0Hit = 1
                    }
                }
            }
        });
        return buffer
    }


}

export default class PPU {
    constructor(cpu) {
        this.cpu = cpu;

        this.cycle = 0;
        this.scanline = -1;
        this.frame = 0;

        this.frameBuffer = new Uint32Array(256 * 240);
        this.memory = new PPUMemory();

        this.loopy = new LoopyRegister()

        this.registers = new VideoRegisters(this)
        this.spriteRenderer = new SpriteRenderer(this)
        this.colorIndexes = new Uint8Array(256 * 240);
        this.backgroundRenderer = new BackgroundRenderer(this)
    }

    onLoad(mapper) {
        this.mapper = mapper
    }

    step(onFrame, onInterrupt) {
        if (this.scanline == -1)
            this._onPreLine()

        if (this.scanline < 240 && this.scanline > -1)
            this._onVisibleLine()

        if (this.scanline == 241)
            this._onVBlankLine(onInterrupt)


        this.cycle++;
        if (this.cycle >= 341) {
            this.cycle = 0;
            this.scanline++;
            if (this.scanline >= 261) {
                this.scanline = -1;
                this.frame++;
                onFrame(this.frameBuffer);
            }
        }

    }

    plot(x, y, color) {
        this.frameBuffer[y * 256 + x] = this.registers.ppuMask.transform(color)
    }

    plotBG(x, y, color, colorIndex) {
        this.colorIndexes[y * 256 + x] = colorIndex;
        this.plot(x, y, color);
        if (this.registers.ppuMask.showBackground)
            this.loopy.onPlot(x);
    }

    isBackgroundPixelOpaque(x, y) {
        if (this.colorIndexes[y * 256 + x] > 0) return true
        return false
    }

    getColor(paletteId, colorIndex) {
        const startAddr = 0x3f00 + paletteId * 4
        const masterColorIndex = this.memory.read(startAddr + colorIndex)
        return masterPalette[masterColorIndex]
    }

    _onPreLine() {
        if (!this.registers.ppuMask.isRenderingEnabled()) return
        if (this.cycle == 1) {
            this.registers.ppuStatus.isInVBlankInterval = 0
            this.registers.ppuStatus.spriteOverflow = 0
            this.registers.ppuStatus.sprite0Hit = 0
        }
        this.loopy.onPreLine(this.cycle);
        if (this.cycle === 260) this.mapper.tick();
    }

    _onVisibleLine() {
        if (this.cycle == 0) {
            this.backgroundRenderer.renderScanline()
            this.spriteRenderer.renderScanline()
        }
        if (!this.registers.ppuMask.isRenderingEnabled()) return

        this.loopy.onVisibleLine(this.cycle);
        if (this.cycle === 260) this.mapper.tick();
    }

    _onVBlankLine(onInterrupt) {
        if (this.cycle == 1) {
            this.registers.ppuStatus.isInVBlankInterval = 1
            if (this.registers.ppuCtrl.generateNMIOnVBlank)
                onInterrupt(interrupts.NMI)
        }
    }
}
