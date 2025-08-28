/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { LightboxData } from '../App';
import { CloseIcon, UploadArrowIcon } from './icons';

interface RegenerateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (newPrompt: string) => void;
    originalData: LightboxData;
}

const RegenerateModal: React.FC<RegenerateModalProps> = ({ isOpen, onClose, onSubmit, originalData }) => {
    const [prompt, setPrompt] = useState(originalData.contentPrompt);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isOpen, prompt]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            onSubmit(prompt.trim());
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-gray-900/20 backdrop-blur-xl z-50 flex items-center justify-center animate-fade-in p-4"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-2xl bg-white/80 backdrop-blur-2xl border border-gray-300/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">修改提示词</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex gap-4">
                    <img src={originalData.url} alt="Reference" className="w-24 h-24 object-cover rounded-lg" />
                    <div className="flex-1">
                        <p className="text-sm text-gray-600">您将使用相同的视觉风格重新生成此图像。请在下方编辑内容提示词。</p>
                        <p className="text-xs text-gray-500 mt-2 truncate">风格: {originalData.styleDescription}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="w-full bg-gray-100 rounded-xl flex items-start gap-2 p-2.5">
                     <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="描述您的图像..."
                        className="w-full bg-transparent p-2 text-base text-gray-800 placeholder-gray-500 focus:outline-none resize-none overflow-y-hidden"
                    />
                    <button 
                        type="submit"
                        className="w-12 h-12 self-center flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center transition-all duration-200 ease-in-out group disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-blue-600 enabled:hover:scale-105"
                        disabled={!prompt.trim()}
                        aria-label="生成"
                    >
                        <UploadArrowIcon className="w-6 h-6 text-gray-200 transition-colors group-hover:text-white" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default RegenerateModal;