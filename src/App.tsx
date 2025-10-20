import React, { useEffect, useRef, useState } from "react";
import Emulator from "./emulator/Emulator.js"; // adjust path to your emulator index.js

const NES_WIDTH = 256;
const NES_HEIGHT = 240;

// --- NES COLOR PALETTE ---
const NES_PALETTE = [
    [84, 84, 84], [0, 30, 116], [8, 16, 144], [48, 0, 136],
    [68, 0, 100], [92, 0, 48], [84, 4, 0], [60, 24, 0],
    [32, 42, 0], [8, 58, 0], [0, 64, 0], [0, 60, 0],
    [0, 50, 60], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    [152, 150, 152], [8, 76, 196], [48, 50, 236], [92, 30, 228],
    [136, 20, 176], [160, 20, 100], [152, 34, 32], [120, 60, 0],
    [84, 90, 0], [40, 114, 0], [8, 124, 0], [0, 118, 40],
    [0, 102, 120], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    [236, 238, 236], [76, 154, 236], [120, 124, 236], [176, 98, 236],
    [228, 84, 236], [236, 88, 180], [236, 106, 100], [212, 136, 32],
    [160, 170, 0], [116, 196, 0], [76, 208, 32], [56, 204, 108],
    [56, 180, 204], [60, 60, 60], [0, 0, 0], [0, 0, 0],
    [236, 238, 236], [168, 204, 236], [188, 188, 236], [212, 178, 236],
    [236, 174, 236], [236, 174, 212], [236, 180, 176], [228, 196, 144],
    [204, 210, 120], [180, 222, 120], [168, 226, 144], [152, 226, 180],
    [160, 214, 228], [160, 162, 160], [0, 0, 0], [0, 0, 0]
];

const keyMap: Record<string, string> = {
    ArrowUp: "BUTTON_UP",
    ArrowDown: "BUTTON_DOWN",
    ArrowLeft: "BUTTON_LEFT",
    ArrowRight: "BUTTON_RIGHT",
    z: "BUTTON_A",
    x: "BUTTON_B",
    Enter: "BUTTON_START",
    Shift: "BUTTON_SELECT"
};

const App: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const emulatorRef = useRef<any>(null);
    const [romData, setRomData] = useState<Uint8Array | null>(null);
    const [volume, setVolume] = useState(0.5);

    // Audio setup
    const audioCtxRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const bufferSize = 4096;
    const sampleRate = 44100;
    let sampleBuffer = new Float32Array(bufferSize);
    let bufferPos = 0;

    const onFrame = (frameBuffer: Uint8Array) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imageData = ctx.createImageData(NES_WIDTH, NES_HEIGHT);
        const rgba = new Uint8ClampedArray(NES_WIDTH * NES_HEIGHT * 4);

        for (let i = 0, j = 0; i < frameBuffer.length; i++, j += 4) {
            const [r, g, b] = NES_PALETTE[frameBuffer[i] % NES_PALETTE.length];
            rgba[j] = r;
            rgba[j + 1] = g;
            rgba[j + 2] = b;
            rgba[j + 3] = 255;
        }

        imageData.data.set(rgba);
        ctx.putImageData(imageData, 0, 0);
    };

    const onSample = (sample: number) => {
        if (!audioCtxRef.current || !gainNodeRef.current) return;

        sampleBuffer[bufferPos++] = sample;
        if (bufferPos >= bufferSize) {
            const audioBuffer = audioCtxRef.current.createBuffer(1, bufferSize, sampleRate);
            audioBuffer.copyToChannel(sampleBuffer, 0);
            const source = audioCtxRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gainNodeRef.current);
            source.start();
            bufferPos = 0;
        }
    };

    const handleRomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const arrayBuffer = await file.arrayBuffer();
        setRomData(new Uint8Array(arrayBuffer));
    };

    const handleStart = () => {
        if (!romData) return;

        // Initialize audio
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNodeRef.current = audioCtxRef.current.createGain();
        gainNodeRef.current.gain.value = volume;
        gainNodeRef.current.connect(audioCtxRef.current.destination);

        // Initialize emulator
        emulatorRef.current = new Emulator(onFrame, onSample);
        emulatorRef.current.load(romData);

        const loop = () => {
            emulatorRef.current.frame();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (gainNodeRef.current) gainNodeRef.current.gain.value = newVolume;
    };

    // 🎮 Keyboard Mapping
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const button = keyMap[e.key];
            if (button && emulatorRef.current) {
                emulatorRef.current.setButton(1, button, true);
                e.preventDefault();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const button = keyMap[e.key];
            if (button && emulatorRef.current) {
                emulatorRef.current.setButton(1, button, false);
                e.preventDefault();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    return (
        // FIX 1: Added 'flex flex-col' to the main container.
        // This centers all content (h1, canvas, controls div) both horizontally and vertically.
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
            <h1 className="text-3xl mb-6 font-extrabold text-red-500 tracking-wider">
                <span className="text-4xl mr-2">🕹️</span>
                NES Emulator
            </h1>

            <div className="w-full max-w-4xl flex justify-center">
                <canvas
                    ref={canvasRef}
                    width={NES_WIDTH}
                    height={NES_HEIGHT}
                    // FIX 2: Responsive and aspect ratio safe styling
                    style={{
                        width: "min(95vw, 1024px)", // Use 95% of viewport, but max out at 1024px
                        height: "auto", // Auto-calculate height to maintain aspect ratio
                        aspectRatio: `${NES_WIDTH} / ${NES_HEIGHT}`,
                        border: "4px solid #4f46e5", // Indigo border
                        boxShadow: "0 0 25px rgba(79, 70, 229, 0.8)",
                        borderRadius: '8px',
                        imageRendering: 'pixelated', // Crucial for pixel art
                    }}
                />
            </div>


            {/* Changed span to div for better semantic structure */}
            <div className="mt-8 flex flex-col items-center gap-4 p-4 bg-gray-800 rounded-xl shadow-lg w-full max-w-lg">

                <div className="flex flex-col md:flex-row items-center gap-4 w-full justify-center">
                    <input
                        type="file"
                        accept=".nes"
                        onChange={handleRomUpload}
                        className="text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600 cursor-pointer"
                    />

                    <button
                        onClick={handleStart}
                        className={`px-6 py-2 rounded-lg font-bold text-lg transition duration-200 shadow-md ${romData
                                ? "bg-green-600 hover:bg-green-700 active:scale-95"
                                : "bg-gray-500 cursor-not-allowed"
                            }`}
                        disabled={!romData}
                    >
                        ▶ Start Game
                    </button>
                </div>

                <p className="text-sm text-yellow-400 font-medium">{status}</p>


                <label className="flex flex-col items-center text-white mt-2 w-full max-w-xs">
                    <span className="mb-2">Volume: {Math.round(volume * 100)}%</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg"
                    />
                </label>

                {/* FIX 3 & 4: Used flex-wrap and better spacing for controls for responsiveness */}
                <div className="mt-4 text-sm flex flex-wrap justify-center gap-x-6 gap-y-2 text-gray-300 border-t border-gray-700 pt-4 w-full">
                    <p className="font-semibold text-white">🕹️ Controls:</p>
                    <p>Arrows = Move</p>
                    <p>Z = A</p>
                    <p>X = B</p>
                    <p>Enter = Start</p>
                    <p>Shift = Select</p>
                </div>

            </div>

            <footer className="text-xs text-gray-600 mt-6">
                <p>Simple NES Emulator Proof of Concept</p>
            </footer>
        </div >
    );
};

export default App;

