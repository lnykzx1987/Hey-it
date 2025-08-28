/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CloseIcon, ImagesIcon, DeleteIcon } from './icons';

type EditingImage = { file?: File; url: string; };

export interface StyleModalData {
    name: string;
    styleDescription: string;
    initialImages: { file?: File, url: string }[];
}

interface SaveStyleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; styleDescription: string; images: EditingImage[] }) => void;
    initialData: StyleModalData | null;
}

const SaveStyleModal: React.FC<SaveStyleModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [styleName, setStyleName] = useState('');
    const [styleDescription, setStyleDescription] = useState('');
    const [images, setImages] = useState<EditingImage[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && initialData) {
            setStyleName(initialData.name);
            setStyleDescription(initialData.styleDescription);
            setImages(initialData.initialImages);
        }
    }, [isOpen, initialData]);

    // Clean up created object URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            images.forEach(image => {
                if (image.file) { // Only revoke URLs created from a File object
                    URL.revokeObjectURL(image.url);
                }
            });
        };
    }, [images]);

    const handleSave = () => {
        onSave({ name: styleName, styleDescription, images });
    };

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;
        const newImages = Array.from(files).map(file => ({
            file,
            url: URL.createObjectURL(file)
        }));
        setImages(prev => [...prev, ...newImages]);
    };

    const handleRemoveImage = (indexToRemove: number) => {
        const imageToRemove = images[indexToRemove];
        if (imageToRemove.file) {
            URL.revokeObjectURL(imageToRemove.url);
        }
        setImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };
    
    const handleDragEvents = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragEnter = (e: React.DragEvent) => { handleDragEvents(e); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { handleDragEvents(e); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        handleDragEvents(e);
        setIsDragging(false);
        if (e.dataTransfer.files) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-gray-900/20 backdrop-blur-xl z-50 flex items-center justify-center animate-fade-in p-4"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-2xl bg-white/90 backdrop-blur-2xl border border-gray-300/80 rounded-2xl shadow-2xl flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-gray-900">保存新风格</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition-colors">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">为您的风格命名，调整描述，并添加或移除参考图。</p>
                </div>
                
                {/* Body */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label htmlFor="style-name" className="text-sm font-medium text-gray-700 mb-1 block">风格名称</label>
                        <input
                            id="style-name"
                            type="text"
                            value={styleName}
                            onChange={(e) => setStyleName(e.target.value)}
                            placeholder="例如：我的赛博朋克风格"
                            className="w-full bg-gray-100 border border-gray-300 text-gray-800 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <label htmlFor="style-desc" className="text-sm font-medium text-gray-700 mb-1 block">风格描述 (AI 提示词)</label>
                        <textarea
                            id="style-desc"
                            rows={4}
                            value={styleDescription}
                            onChange={(e) => setStyleDescription(e.target.value)}
                            placeholder="例如：cinematic photo, dramatic lighting, high detail..."
                            className="w-full bg-gray-100 border border-gray-300 text-gray-800 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-y"
                        />
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">参考图片</label>
                        <div 
                            className={`w-full p-2 bg-gray-50 rounded-lg border-2 border-dashed  transition-colors ${isDragging ? 'border-blue-500' : 'border-gray-300'}`}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragEvents}
                            onDrop={handleDrop}
                        >
                             <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => handleFileSelect(e.target.files)}
                                className="hidden"
                                accept="image/*"
                                multiple
                            />
                            {images.length === 0 ? (
                                <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center text-center p-8 text-gray-500 hover:text-gray-600 cursor-pointer">
                                    <ImagesIcon className="w-10 h-10 mb-2" />
                                    <p className="font-semibold">拖拽图片到此处</p>
                                    <p className="text-sm">或点击浏览文件</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                    {images.map((image, index) => (
                                         <div key={index} className="relative group aspect-square">
                                            <img src={image.url} alt={`reference ${index}`} className="w-full h-full object-cover rounded-md" />
                                            <button 
                                                onClick={() => handleRemoveImage(index)}
                                                className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <DeleteIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center aspect-square bg-gray-200 hover:bg-gray-300 rounded-md">
                                         <ImagesIcon className="w-8 h-8 text-gray-500" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-semibold text-gray-800 transition-colors">
                        取消
                    </button>
                     <button onClick={handleSave} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold text-white transition-colors">
                        保存风格
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaveStyleModal;