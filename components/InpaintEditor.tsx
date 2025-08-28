/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LightboxData } from '../App';
import { generateEditedImage } from '../services/geminiService';
import { CloseIcon, UploadArrowIcon } from './icons';
import Spinner from './Spinner';

interface InpaintEditorProps {
    image: LightboxData;
    onComplete: (newImageUrl: string) => void;
    onClose: () => void;
}

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
};

const InpaintEditor: React.FC<InpaintEditorProps> = ({ image, onComplete, onClose }) => {
    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(40);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resizeCanvas = useCallback(() => {
        const imageEl = imageRef.current;
        const canvasEl = canvasRef.current;
        const containerEl = containerRef.current;
        if (imageEl && canvasEl && containerEl) {
            const containerWidth = containerEl.offsetWidth;
            const containerHeight = containerEl.offsetHeight;
            const imgAspectRatio = imageEl.naturalWidth / imageEl.naturalHeight;
            const containerAspectRatio = containerWidth / containerHeight;

            let finalWidth, finalHeight;
            if (imgAspectRatio > containerAspectRatio) {
                finalWidth = containerWidth;
                finalHeight = containerWidth / imgAspectRatio;
            } else {
                finalHeight = containerHeight;
                finalWidth = containerHeight * imgAspectRatio;
            }
            
            canvasEl.width = finalWidth;
            canvasEl.height = finalHeight;
            imageEl.style.width = `${finalWidth}px`;
            imageEl.style.height = `${finalHeight}px`;
        }
    }, []);

    useEffect(() => {
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [resizeCanvas]);

    const getMousePos = (e: React.MouseEvent): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const startDrawing = useCallback((e: React.MouseEvent) => {
        setIsDrawing(true);
        draw(e);
    }, []);

    const stopDrawing = useCallback(() => {
        setIsDrawing(false);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
        }
    }, []);

    const draw = useCallback((e: React.MouseEvent) => {
        if (!isDrawing) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const { x, y } = getMousePos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }, [isDrawing]);

    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, [brushSize]);

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };
    
    const handleGenerate = async () => {
        const canvas = canvasRef.current;
        if (!prompt.trim() || !canvas) return;

        setIsLoading(true);
        setError(null);

        try {
            // 1. Create mask file
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) throw new Error("Could not create mask context");

            // Fill with black (area to keep)
            maskCtx.fillStyle = 'black';
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            // Draw user's mask in white (area to edit)
            maskCtx.drawImage(canvas, 0, 0);

            const maskDataUrl = maskCanvas.toDataURL('image/png');
            const maskFile = await dataUrlToFile(maskDataUrl, 'mask.png');

            // 2. Get original image file
            const originalImageFile = await dataUrlToFile(image.url, 'original.png');
            
            // 3. Call API
            const resultUrl = await generateEditedImage(originalImageFile, maskFile, prompt);

            // 4. Complete
            onComplete(resultUrl);

        } catch (err) {
            console.error("Inpainting failed:", err);
            setError(err instanceof Error ? err.message : '发生未知错误');
        } finally {
            setIsLoading(false);
        }
    };

    const brushCursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize}" height="${brushSize}"><circle cx="${brushSize/2}" cy="${brushSize/2}" r="${(brushSize/2)-1}" fill="rgba(255,255,255,0.5)" stroke="white" stroke-width="1" stroke-dasharray="2,2"/></svg>') ${brushSize/2} ${brushSize/2}, auto`;

    return (
        <div className="fixed inset-0 bg-[#121212] z-50 flex flex-col animate-fade-in">
            {/* Header */}
            <header className="w-full py-3 px-4 sm:px-6 border-b border-gray-800 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold text-white">局部修改</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </header>

            {/* Main Content */}
            <main ref={containerRef} className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
                <img ref={imageRef} src={image.url} alt="Editing image" className="object-contain max-w-full max-h-full block" onLoad={resizeCanvas} crossOrigin="anonymous"/>
                <canvas 
                    ref={canvasRef} 
                    className="absolute"
                    style={{ cursor: brushCursor }}
                    onMouseDown={startDrawing}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    onMouseMove={draw}
                />
            </main>

            {/* Footer / Controls */}
            <footer className="w-full bg-[#1C1C1C] border-t border-gray-800 p-4 flex flex-col gap-4">
                {error && <p className="text-red-400 text-center text-sm animate-fade-in">{error}</p>}
                 {isLoading && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                        <Spinner />
                        <p className="text-white mt-4">正在生成，请稍候...</p>
                    </div>
                 )}
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-300">笔刷大小:</label>
                    <input 
                        type="range" min="5" max="100" value={brushSize} 
                        onChange={e => setBrushSize(Number(e.target.value))}
                        className="flex-grow"
                    />
                    <button onClick={handleClear} className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-200 transition-colors">清除</button>
                </div>
                <div className="w-full bg-gray-900/50 rounded-xl flex items-start gap-2 p-2.5">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="描述您想做的修改 (例如 '给猫咪加一顶帽子')"
                        className="w-full bg-transparent p-2 text-base text-gray-200 placeholder-gray-500 focus:outline-none"
                        disabled={isLoading}
                    />
                    <button 
                        onClick={handleGenerate}
                        className="w-12 h-12 self-center flex-shrink-0 bg-white/10 rounded-full flex items-center justify-center transition-all duration-200 ease-in-out group disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-blue-600 enabled:hover:scale-105"
                        disabled={!prompt.trim() || isLoading}
                        aria-label="生成"
                    >
                        <UploadArrowIcon className="w-6 h-6 text-gray-300 transition-colors group-hover:text-white" />
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default InpaintEditor;
