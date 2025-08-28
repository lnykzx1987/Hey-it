/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeDocumentForImagePrompts, extractTextFromFile, generateStyledImages, translatePromptsToEnglish, fileToGenerativePart } from '../services/geminiService';
import { ImagesIcon, DeleteIcon, RegenerateIcon, CloseIcon, PlayIcon } from './icons';
import CircularProgress from './CircularProgress';

// Declare global variable from CDN script
declare const JSZip: any;

interface VipTask {
    id: number;
    name: string;
    prompt: string;
    status: 'pending' | 'generating' | 'completed' | 'failed';
    imageUrl?: string;
    error?: string;
}

type EditingImage = { file: File; url: string; };

// --- Style Definitions ---
const appleButtonBase = "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ease-in-out shadow-sm hover:shadow-md hover:-translate-y-px active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none";
const appleButtonPrimary = `${appleButtonBase} bg-blue-500 text-white hover:bg-blue-600`;
const appleButtonSecondary = `${appleButtonBase} bg-gray-200 text-gray-800 hover:bg-gray-300`;
const appleButtonWarning = `${appleButtonBase} bg-yellow-500 text-white hover:bg-yellow-600`;
const appleButtonSuccess = `${appleButtonBase} bg-green-500 text-white hover:bg-green-600`;

const appleButtonSmallBase = "flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ease-in-out active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const appleButtonSmallPrimary = `${appleButtonSmallBase} bg-blue-500 text-white hover:bg-blue-600`;
const appleButtonSmallSecondary = `${appleButtonSmallBase} bg-gray-200 text-gray-800 hover:bg-gray-300`;


const VipMode: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [tasks, setTasks] = useState<VipTask[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Style Transfer State ---
    const [referenceImages, setReferenceImages] = useState<EditingImage[]>([]);
    const [mainStylePrompt, setMainStylePrompt] = useState('');
    const styleFileInputRef = useRef<HTMLInputElement>(null);
    const [isStyleDragging, setIsStyleDragging] = useState(false);

    // --- Generation Control State ---
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const generationIndexRef = useRef(0);

    // --- UI State ---
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // --- Effects ---
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setLightboxImage(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // --- File Handling ---
    const handleFileChange = (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type === 'text/plain' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
                setUploadedFile(file);
                setInputText(''); 
                setError(null);
            } else {
                setError('不支持的文件类型。请上传 .txt 或 .docx 文件。');
            }
        }
    };
    
    const handleStyleFileChange = (files: FileList | null) => {
        if (!files) return;
        const newImages = Array.from(files).map(file => ({
            file,
            url: URL.createObjectURL(file)
        }));
        setReferenceImages(prev => [...prev, ...newImages]);
    };
    
    const handleRemoveStyleImage = (indexToRemove: number) => {
        const imageToRemove = referenceImages[indexToRemove];
        URL.revokeObjectURL(imageToRemove.url);
        setReferenceImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // --- Core Logic ---
    const handleAnalyze = async () => {
        let textToAnalyze = '';
        try {
            textToAnalyze = uploadedFile ? await extractTextFromFile(uploadedFile) : inputText;
        } catch (err) {
            setError(err instanceof Error ? err.message : "读取文件失败。");
            return;
        }

        if (!textToAnalyze.trim()) {
            setError("请输入文本或上传文档以进行分析。");
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setTasks([]);

        try {
            const analyzedPrompts = await analyzeDocumentForImagePrompts(textToAnalyze);
            setTasks(analyzedPrompts.map((p, i) => ({ id: i, ...p, status: 'pending' })));
        } catch (err) {
            const friendlyError = "分析失败。可能是暂时性的服务问题，请稍后再试。";
            console.error(err);
            setError(friendlyError);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleTranslateAll = async () => {
        if(tasks.length === 0 || isGenerating) return;
        const originalPrompts = tasks.map(t => t.prompt);
        const translatedPrompts = await translatePromptsToEnglish(originalPrompts);
        setTasks(prevTasks => prevTasks.map((task, i) => ({
            ...task,
            prompt: translatedPrompts[i] || originalPrompts[i],
        })));
    }
    
    const getErrorMessage = (err: unknown): string => {
        // Prioritize checking for the specific API error object structure
        if (typeof err === 'object' && err !== null) {
            const apiError = (err as any).error;
            if (apiError && typeof apiError.message === 'string' && typeof apiError.status === 'string') {
                const message = apiError.message;
                const status = apiError.status.toUpperCase();
                
                if (status === 'RESOURCE_EXHAUSTED') {
                    return "API 配额已用尽。请检查您的 Google AI 计划和账单详情。";
                }
                 if (apiError.code === 500) {
                    return "生成失败 (服务器错误)。请检查您的 API 密钥设置或稍后重试。";
                }
                return `生成失败: ${message}`;
            }
        }

        // Fallback for standard Error instances
        if (err instanceof Error) {
            const errText = err.message;
            if (errText.includes('429') || errText.includes('RESOURCE_EXHAUSTED') || errText.includes('quota')) {
                return "API 配额已用尽。请检查您的 Google AI 计划和账单详情。";
            }
            return errText;
        }
        
        // Fallback for string errors
        if (typeof err === 'string') {
            if (err.includes('429') || err.includes('RESOURCE_EXHAUSTED') || err.includes('quota')) {
                return "API 配额已用尽。请检查您的 Google AI 计划和账单详情。";
            }
            return err;
        }

        return "发生未知错误。请稍后再试。";
    }

    // --- Generation Process ---
    const processGenerationQueue = useCallback(async () => {
        if (isPaused) {
            setIsGenerating(false);
            return;
        }
        setIsGenerating(true);
        
        const referenceImageParts = await Promise.all(
            referenceImages.map(img => fileToGenerativePart(img.file))
        );

        for (let i = generationIndexRef.current; i < tasks.length; i++) {
            // Re-check for pause inside the loop
            if (isPaused) {
                 generationIndexRef.current = i;
                 setIsGenerating(false);
                 return;
            }
            const task = tasks[i];
            if (task.status === 'completed') continue;

            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'generating' } : t));
            
            try {
                const styleDesc = mainStylePrompt || 'photorealistic, high detail, cinematic lighting';
                const images = await generateStyledImages(styleDesc, task.prompt, 1, '16:9', referenceImageParts);
                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', imageUrl: images[0] } : t));
            } catch (err) {
                console.error(`Error generating task ${task.id}:`, err);
                const errorMessage = getErrorMessage(err);
                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'failed', error: errorMessage } : t));
            }
        }
        
        setIsGenerating(false);
        generationIndexRef.current = 0; // Reset after finishing
    }, [tasks, referenceImages, mainStylePrompt, isPaused]);


    useEffect(() => {
        if(isGenerating && !isPaused) {
            processGenerationQueue();
        }
    }, [isGenerating, isPaused, processGenerationQueue]);


    const handleGenerateAll = () => {
        generationIndexRef.current = 0;
        setIsPaused(false);
        setIsGenerating(true);
    };

    const handlePause = () => setIsPaused(true);

    const handleResume = () => {
        setIsPaused(false);
        setIsGenerating(true); // This will trigger the useEffect to call processGenerationQueue
    };

    const handleGenerateSingleTask = async (taskId: number) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || isGenerating) return;
        
        const referenceImageParts = await Promise.all(
            referenceImages.map(img => fileToGenerativePart(img.file))
        );

        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'generating', error: undefined } : t));
        try {
            const styleDesc = mainStylePrompt || 'photorealistic, high detail, cinematic lighting';
            const images = await generateStyledImages(styleDesc, task.prompt, 1, '16:9', referenceImageParts);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', imageUrl: images[0] } : t));
        } catch (err) {
            console.error(`Error regenerating task ${taskId}:`, err);
            const errorMessage = getErrorMessage(err);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'failed', error: errorMessage } : t));
        }
    }
    
    // --- UI Handlers ---
    const handleUpdateTaskPrompt = (taskId: number, newPrompt: string) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, prompt: newPrompt } : t));
    };
    
    const handleDownloadAll = async () => {
        const zip = new JSZip();
        const completedTasks = tasks.filter(t => t.status === 'completed' && t.imageUrl);
        if(completedTasks.length === 0) return;
        
        for (const task of completedTasks) {
            try {
                const response = await fetch(task.imageUrl!);
                const blob = await response.blob();
                zip.file(`${task.name}.png`, blob);
            } catch (error) {
                console.error(`下载图片 ${task.name} 失败:`, error);
            }
        }

        zip.generateAsync({ type: "blob" }).then(function(content: Blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `HeyIt-批量导出-${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    // --- Drag & Drop Handlers ---
    const createDragHandlers = (setter: React.Dispatch<React.SetStateAction<boolean>>) => ({
        handleDragEvents: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); },
        handleDragEnter: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setter(true); },
        handleDragLeave: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setter(false); },
    });
    
    const mainDropHandlers = createDragHandlers(setIsDragging);
    const styleDropHandlers = createDragHandlers(setIsStyleDragging);
    
    const handleDrop = (e: React.DragEvent) => {
        mainDropHandlers.handleDragEvents(e);
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files);
        }
    };
    
    const handleStyleDrop = (e: React.DragEvent) => {
        styleDropHandlers.handleDragEvents(e);
        setIsStyleDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleStyleFileChange(e.dataTransfer.files);
        }
    };

    // --- Computed State ---
    const isAnalyzeDisabled = isAnalyzing || isGenerating;
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const isDownloadDisabled = completedCount === 0 || isGenerating;

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 animate-fade-in">
            {lightboxImage && (
                 <div 
                  className="fixed inset-0 bg-gray-900/20 backdrop-blur-xl z-50 flex items-center justify-center animate-fade-in"
                  onClick={() => setLightboxImage(null)}
                >
                    <div className="relative w-full h-full flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
                        <img src={lightboxImage} alt="放大预览" className="object-contain max-w-[95vw] max-h-[95vh] rounded-lg shadow-2xl" />
                        <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 bg-white/50 text-black rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:scale-110 hover:bg-white/80 transition-all" aria-label="关闭预览">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
            
            {/* Top Control Bar */}
            <div className="shrink-0 sticky top-16 z-20 flex items-center justify-between gap-4 p-4 border-b border-gray-200 bg-white/80 backdrop-blur-lg">
                 <div className="flex items-center gap-3">
                    <button onClick={handleAnalyze} disabled={isAnalyzeDisabled} className={appleButtonPrimary}>
                        {isAnalyzing ? '分析中...' : '分析文案'}
                    </button>
                 </div>
                 <div className="flex items-center gap-3">
                    {tasks.length > 0 && <span className="text-lg font-mono text-gray-600">{completedCount} / {tasks.length}</span>}
                     {isGenerating && !isPaused && <button onClick={handlePause} className={appleButtonWarning}>暂停</button>}
                     {isPaused && <button onClick={handleResume} className={appleButtonPrimary}>继续</button>}
                     {!isGenerating && (
                        <button onClick={handleGenerateAll} disabled={tasks.length === 0} className={appleButtonSuccess}>
                            生成全部图片
                        </button>
                     )}
                    <button onClick={handleDownloadAll} disabled={isDownloadDisabled} className={appleButtonSecondary}>
                        下载全部
                    </button>
                 </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-y-auto">
                {/* Input/Style Panel */}
                <div className="w-1/3 p-4 flex flex-col gap-4 border-r border-gray-200 overflow-y-auto">
                    {/* Step 1: Document Input */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-2">步骤 1: 提供文案</h3>
                        <div 
                            className={`relative border border-dashed rounded-lg transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                            onDragEnter={mainDropHandlers.handleDragEnter} onDragLeave={mainDropHandlers.handleDragLeave} onDragOver={mainDropHandlers.handleDragEvents} onDrop={handleDrop}
                        >
                            <textarea
                                value={inputText}
                                onChange={(e) => { setInputText(e.target.value); setUploadedFile(null); }}
                                placeholder="在此处粘贴长文案..."
                                className="w-full h-32 bg-gray-100 text-gray-800 rounded-t-lg p-3 focus:ring-1 focus:ring-blue-500 focus:outline-none transition resize-y"
                                disabled={isAnalyzeDisabled}
                            />
                            <div className="p-3 border-t border-gray-300 bg-gray-50 rounded-b-lg">
                                <input type="file" id="file-upload" className="hidden" onChange={e => handleFileChange(e.target.files)} accept=".txt,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" ref={fileInputRef}/>
                                <button onClick={() => fileInputRef.current?.click()} className="w-full text-center text-sm text-gray-500 hover:text-gray-800">
                                    {uploadedFile ? (
                                        <span className="font-semibold text-green-600 block truncate">{uploadedFile.name}</span>
                                    ) : (
                                        <span>或 <span className="underline">上传文档</span> (.txt, .docx)</span>
                                    )}
                                </button>
                                {uploadedFile && <button onClick={() => setUploadedFile(null)} className="mt-1 w-full text-xs text-red-500 hover:text-red-400">移除文件</button>}
                            </div>
                        </div>
                    </div>
                    {error && <p className="text-center text-red-500 text-sm animate-fade-in">{error}</p>}
                    
                    {/* Step 2: Style Input */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-2">步骤 2 (可选): 提供统一风格</h3>
                        <div className="space-y-3">
                            <div 
                                className={`relative p-2 bg-gray-100 rounded-lg border-2 border-dashed transition-colors ${isStyleDragging ? 'border-blue-500' : 'border-gray-300'}`}
                                onDragEnter={styleDropHandlers.handleDragEnter} onDragLeave={styleDropHandlers.handleDragLeave} onDragOver={styleDropHandlers.handleDragEvents} onDrop={handleStyleDrop}
                            >
                                <input type="file" ref={styleFileInputRef} onChange={(e) => handleStyleFileChange(e.target.files)} className="hidden" accept="image/*" multiple />
                                {referenceImages.length === 0 ? (
                                    <div onClick={() => styleFileInputRef.current?.click()} className="flex flex-col items-center justify-center text-center p-6 text-gray-500 hover:text-gray-700 cursor-pointer">
                                        <ImagesIcon className="w-8 h-8 mb-2" />
                                        <p className="font-semibold text-sm">拖拽风格参考图至此</p>
                                        <p className="text-xs">或点击浏览文件</p>
                                    </div>
                                ) : (
                                     <div className="grid grid-cols-3 gap-2">
                                        {referenceImages.map((image, index) => (
                                            <div key={index} className="relative group aspect-square">
                                                <img src={image.url} alt={`ref ${index}`} className="w-full h-full object-cover rounded-md" />
                                                <button onClick={() => handleRemoveStyleImage(index)} className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"><DeleteIcon className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ))}
                                        <button onClick={() => styleFileInputRef.current?.click()} className="flex items-center justify-center aspect-square bg-gray-200 hover:bg-gray-300 rounded-md"><ImagesIcon className="w-6 h-6 text-gray-500" /></button>
                                    </div>
                                )}
                            </div>
                            <textarea
                                value={mainStylePrompt}
                                onChange={(e) => setMainStylePrompt(e.target.value)}
                                placeholder="或在此输入主风格提示词 (例如 cinematic lighting, hyperrealistic)"
                                className="w-full h-20 bg-gray-100 text-gray-800 rounded-lg p-3 focus:ring-1 focus:ring-blue-500 focus:outline-none transition resize-y text-sm"
                                disabled={isGenerating}
                            />
                        </div>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="flex-1 flex flex-col">
                    {tasks.length > 0 && (
                        <div className="px-4 py-3 border-b border-gray-200">
                            <button onClick={handleTranslateAll} disabled={isGenerating || tasks.length === 0} className={appleButtonSecondary}>
                                翻译为英文
                            </button>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto space-y-3 p-4">
                        {tasks.map(task => (
                            <div key={task.id} className="flex items-stretch gap-4 p-3 bg-white rounded-lg border border-gray-200 animate-fade-in shadow-sm">
                                <div className="flex-1 flex items-start gap-3">
                                    <span className="text-sm font-bold text-gray-500 pt-2">{task.id + 1}.</span>
                                    <textarea 
                                        value={task.prompt}
                                        onChange={(e) => handleUpdateTaskPrompt(task.id, e.target.value)}
                                        className="w-full h-full min-h-[10rem] bg-gray-100/50 p-2 rounded-md text-gray-800 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="w-1/3 flex flex-col items-center justify-center">
                                    <div className="relative w-full aspect-video bg-gray-100 rounded-md flex items-center justify-center overflow-hidden mb-2">
                                        {task.status === 'generating' && <CircularProgress progress={50} size="w-16 h-16" text="生成中"/>}
                                        {task.status === 'failed' && (
                                            <div className="text-center p-2">
                                                <p className="text-red-600 text-sm font-semibold">生成失败</p>
                                                <p className="text-red-700 text-xs mt-1">{task.error}</p>
                                            </div>
                                        )}
                                        {task.status === 'completed' && task.imageUrl && (
                                            <>
                                                <img src={task.imageUrl} alt={task.name} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxImage(task.imageUrl)}/>
                                                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                    <a href={task.imageUrl} download={`${task.name}.png`} title="单独下载" className="p-2.5 bg-gray-800/80 rounded-full hover:bg-green-600"><DownloadIcon className="w-5 h-5 text-white" /></a>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                     <div className="w-full">
                                        {task.status === 'pending' && (
                                            <button onClick={() => handleGenerateSingleTask(task.id)} disabled={isGenerating} className={appleButtonSmallPrimary}>
                                                <PlayIcon className="w-4 h-4" />
                                                <span>生成此图</span>
                                            </button>
                                        )}
                                        {(task.status === 'completed' || task.status === 'failed') && (
                                            <button onClick={() => handleGenerateSingleTask(task.id)} disabled={isGenerating} className={appleButtonSmallSecondary}>
                                                <RegenerateIcon className="w-4 h-4" />
                                                <span>重新生成</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {tasks.length === 0 && !isAnalyzing && (
                            <div className="text-center text-gray-400 pt-16">
                                <p>分析结果将显示在此处</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

export default VipMode;