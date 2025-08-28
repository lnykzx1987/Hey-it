/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { AspectRatio, ActiveStyle } from '../App';
import { FrameIcon, UploadArrowIcon, ImagesIcon, CloseIcon, BookmarkIcon, PlusIcon } from './icons';

interface PromptBarProps {
    onGenerate: (task: {
        contentPrompt: string;
        numImages: number;
        aspectRatio: AspectRatio;
        styleDescription?: string;
        referenceImageParts?: { inlineData: { mimeType: string; data: string; } }[];
    }) => void;
    isProcessing: boolean;
    queueLength: number;
    activeStyle: ActiveStyle | null;
    onClearStyle: () => void;
    onOpenSaveStyle: () => void;
    onStyleImagesSelected: (files: File[]) => void;
    onRemoveStyleImage: (index: number) => void;
}

type PopoverOption<T> = { value: T; label: string; icon: React.ReactNode; };

const RadioCircle: React.FC<{ isSelected: boolean }> = ({ isSelected }) => (
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-500' : 'border-gray-400'}`}>
        {isSelected && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}
    </div>
);

const PopoverMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    options: PopoverOption<any>[];
    selectedValue: any;
    onSelect: (value: any) => void;
    title: string;
    triggerRef: React.RefObject<HTMLButtonElement>;
}> = ({ isOpen, onClose, options, selectedValue, onSelect, title, triggerRef }) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isOpen &&
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, triggerRef]);

    if (!isOpen) return null;

    return (
        <div ref={popoverRef} className="absolute bottom-full mb-2 w-64 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl shadow-2xl p-2 animate-fade-in-up z-10">
            <h3 className="text-sm font-semibold text-gray-800 px-2 pt-1 pb-2">{title}</h3>
            <div className="flex flex-col gap-1">
                {options.map(option => (
                    <button
                        key={option.label}
                        onClick={() => { onSelect(option.value); onClose(); }}
                        className="w-full flex items-center justify-between text-left px-2 py-2 rounded-lg text-gray-800 hover:bg-gray-200/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            {option.icon}
                            <span className="text-sm font-medium">{option.label}</span>
                        </div>
                        <RadioCircle isSelected={selectedValue === option.value} />
                    </button>
                ))}
            </div>
        </div>
    );
};

const PromptBar: React.FC<PromptBarProps> = ({ onGenerate, isProcessing, queueLength, activeStyle, onClearStyle, onOpenSaveStyle, onStyleImagesSelected, onRemoveStyleImage }) => {
    // --- State ---
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [numImages, setNumImages] = useState(2);
    const [isAspectRatioPopoverOpen, setAspectRatioPopoverOpen] = useState(false);
    const [isNumImagesPopoverOpen, setNumImagesPopoverOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // --- Refs ---
    const aspectTriggerRef = useRef<HTMLButtonElement>(null);
    const numImagesTriggerRef = useRef<HTMLButtonElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- Handlers ---
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            onGenerate({ 
                contentPrompt: prompt, 
                numImages, 
                aspectRatio,
                styleDescription: activeStyle?.styleDescription,
                referenceImageParts: activeStyle?.images.map(img => img.part)
            });
            setPrompt('');
        }
    };

    const handleImageSelectClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onStyleImagesSelected(Array.from(e.target.files));
        }
        e.target.value = ''; // Reset input
    };
    
    const handleDragEvents = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        handleDragEvents(e);
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };
    
    const handleDragLeave = (e: React.DragEvent) => {
        handleDragEvents(e);
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        handleDragEvents(e);
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onStyleImagesSelected(Array.from(e.dataTransfer.files));
            e.dataTransfer.clearData();
        }
    };

    // --- Effects ---
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [prompt]);

    // --- Constants ---
    const aspectOptions: PopoverOption<AspectRatio>[] = [
        { value: '16:9', label: '16:9', icon: <FrameIcon className="w-5 h-5 text-gray-500" /> },
        { value: '3:2', label: '3:2', icon: <FrameIcon className="w-5 h-5 text-gray-500" /> },
        { value: '9:16', label: '9:16', icon: <FrameIcon className="w-5 h-5 text-gray-500" /> },
    ];
    const numImagesOptions: PopoverOption<number>[] = [
        { value: 4, label: '4 张图片', icon: <ImagesIcon className="w-5 h-5 text-gray-500" /> },
        { value: 2, label: '2 张图片', icon: <ImagesIcon className="w-5 h-5 text-gray-500" /> },
        { value: 1, label: '1 张图片', icon: <ImagesIcon className="w-5 h-5 text-gray-500" /> },
    ];
    const isGenerateDisabled = !prompt.trim();
    const hasActiveStyle = !!activeStyle && (activeStyle.images.length > 0 || !!activeStyle.styleDescription);

    return (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center p-4">
            <div className="relative w-full max-w-4xl">
                 <form 
                    onSubmit={handleSubmit} 
                    className={`relative w-full bg-white/70 border border-gray-300/80 rounded-2xl shadow-2xl backdrop-blur-lg flex flex-col gap-2 p-2.5 transition-all duration-300 ${isDragging ? 'ring-2 ring-blue-500 scale-105' : ''}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragEvents}
                    onDrop={handleDrop}
                >
                    {isDragging && (
                         <div className="absolute inset-0 bg-blue-500/20 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-fade-in z-20">
                            <ImagesIcon className="w-12 h-12 text-blue-500" />
                            <p className="mt-2 text-lg font-semibold text-blue-700">拖拽图片以提取风格</p>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                        multiple
                    />
                    
                    {/* --- Style Images Preview --- */}
                    {activeStyle && activeStyle.images.length > 0 && (
                        <div className="flex items-center gap-3 px-2 pt-1 animate-fade-in-up">
                            {activeStyle.images.map((image, index) => (
                                <div key={index} className="relative group w-24 h-24 flex-shrink-0">
                                    <img src={image.url} alt={`Style reference ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                                    <button
                                        type="button"
                                        onClick={() => onRemoveStyleImage(index)}
                                        className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full p-1 hover:bg-red-500 transition-colors z-10 opacity-0 group-hover:opacity-100"
                                        aria-label="Remove style image"
                                    >
                                        <CloseIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleImageSelectClick}
                                className="w-24 h-24 flex-shrink-0 flex flex-col items-center justify-center bg-gray-200/50 rounded-lg border-2 border-dashed border-gray-400 hover:border-gray-500 transition-colors"
                                title="点击上传或拖拽图片以添加风格参考"
                            >
                                <PlusIcon className="w-8 h-8 text-gray-500" />
                            </button>
                        </div>
                    )}


                    <div className="flex items-start gap-2">
                        {/* --- Main Text Area --- */}
                        <div className="flex-grow flex flex-col">
                            <textarea
                                ref={textareaRef}
                                rows={1}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder={
                                    activeStyle 
                                    ? activeStyle.styleDescription === '正在从图片分析风格...' 
                                        ? '分析中...' 
                                        : `"${activeStyle.name}" 风格的...`
                                    : "描述您的图像，或拖拽图片到此处开始..."
                                }
                                className="w-full bg-transparent p-2 text-base text-gray-800 placeholder-gray-500 focus:outline-none resize-none overflow-y-hidden"
                            />
                             <div className="flex items-center justify-end gap-2 mt-2">
                                {/* Aspect Ratio Button & Popover */}
                                <div className="relative">
                                    <button ref={aspectTriggerRef} type="button" onClick={() => { setAspectRatioPopoverOpen(o => !o); setNumImagesPopoverOpen(false); }} className="px-4 py-2 bg-gray-200/70 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700 transition-colors">{aspectRatio}</button>
                                    <PopoverMenu isOpen={isAspectRatioPopoverOpen} onClose={() => setAspectRatioPopoverOpen(false)} options={aspectOptions} selectedValue={aspectRatio} onSelect={setAspectRatio} title="宽高比" triggerRef={aspectTriggerRef} />
                                </div>
                                {/* Number of Images Button & Popover */}
                                <div className="relative">
                                    <button ref={numImagesTriggerRef} type="button" onClick={() => { setNumImagesPopoverOpen(o => !o); setAspectRatioPopoverOpen(false); }} className="px-4 py-2 bg-gray-200/70 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700 transition-colors">{numImages}张</button>
                                    <PopoverMenu isOpen={isNumImagesPopoverOpen} onClose={() => setNumImagesPopoverOpen(false)} options={numImagesOptions} selectedValue={numImages} onSelect={setNumImages} title="变体" triggerRef={numImagesTriggerRef} />
                                </div>
                                {/* Save Style Button */}
                                 <button
                                    type="button"
                                    onClick={() => onOpenSaveStyle()}
                                    disabled={!hasActiveStyle}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-200/70 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={"将当前激活的风格保存"}
                                >
                                    <BookmarkIcon className="w-4 h-4" />
                                    <span>保存为风格</span>
                                </button>
                                {hasActiveStyle && (
                                     <button type="button" onClick={onClearStyle} className="p-2 bg-gray-200/70 hover:bg-red-500/20 rounded-full text-sm font-semibold text-gray-700 transition-colors" aria-label="清除风格"><CloseIcon className="w-4 h-4" /></button>
                                )}
                            </div>
                        </div>

                        {/* --- Generate Button --- */}
                        <button 
                            type="submit"
                            className="w-14 h-14 self-stretch flex-shrink-0 bg-gray-800 rounded-xl flex items-center justify-center transition-all duration-200 ease-in-out group disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-blue-600 enabled:hover:scale-105"
                            disabled={isGenerateDisabled}
                            aria-label="生成"
                        >
                        {queueLength > 0 && !isProcessing ? (
                            <span className="text-white text-xs font-bold animate-fade-in text-center leading-tight">排队中<br/>({queueLength})</span>
                        ) : (
                            <UploadArrowIcon className={`w-6 h-6 text-gray-200 transition-colors ${!isGenerateDisabled && 'group-hover:text-white'}`} />
                        )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PromptBar;