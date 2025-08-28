/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ImageGroup, ImageItem, LightboxData } from '../App';
import CircularProgress from './CircularProgress';
import { DeleteIcon, RenameIcon } from './icons';

interface ImageGalleryProps {
    groups: ImageGroup[];
    onImageClick: (data: LightboxData) => void;
    onDeleteImage: (groupIdx: number, imageIdx: number) => void;
    onRenameImage: (groupIdx: number, imageIdx: number, newName: string) => void;
}

const ImageCard: React.FC<{
    image: ImageItem;
    groupIdx: number;
    imageIdx: number;
    onImageClick: (data: LightboxData) => void;
    onDelete: () => void;
    onRename: () => void;
}> = ({ image, onImageClick, onDelete, onRename }) => {
    
    const renderContent = () => {
        switch(image.status) {
            case 'generating':
                return (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <CircularProgress progress={image.progress ?? 0} size="w-24 h-24" />
                    </div>
                );
            case 'queued':
                return (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <CircularProgress progress={0} text="排队中" size="w-24 h-24" />
                    </div>
                );
            case 'failed':
                return (
                     <div className="w-full h-full flex flex-col items-center justify-center bg-red-100/50 text-center p-2">
                        <span className="text-red-600 text-sm font-semibold">生成失败</span>
                        <p className="text-red-700 text-xs mt-1 line-clamp-3">{image.error}</p>
                    </div>
                );
            case 'completed':
                return (
                    <>
                        <img src={image.url} alt={image.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pointer-events-none">
                            <p className="text-white text-sm p-2 truncate">{image.name}</p>
                        </div>
                        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="bg-black/50 hover:bg-blue-600 text-white rounded-md p-1.5 transition-colors" aria-label="重命名图片">
                                <RenameIcon className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-black/50 hover:bg-red-600 text-white rounded-md p-1.5 transition-colors" aria-label="删除图片">
                                <DeleteIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </>
                );
        }
    };
    
    return (
         <div 
            className="relative group aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:shadow-blue-500/10 transition-shadow duration-300 cursor-pointer" 
            onClick={() => image.status === 'completed' && onImageClick({ id: image.id, url: image.url!, styleDescription: image.styleDescription, contentPrompt: image.contentPrompt, name: image.name })}
        >
            {renderContent()}
        </div>
    )
};


const ImageGallery: React.FC<ImageGalleryProps> = ({ groups, onImageClick, onDeleteImage, onRenameImage }) => {

    const renderEmptyState = () => (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-gray-500 p-8">
            <h2 className="text-2xl font-semibold text-gray-800">欢迎使用 Hey It (嘿一下)</h2>
            <p className="mt-2 max-w-md text-gray-600">
                在下方的命令栏中描述您的画面，通过 `+` 按钮或拖拽添加风格参考图，然后点击生成，开启您的 AI 创作之旅。
            </p>
        </div>
    );
    
    const hasContent = groups.some(g => g.images.length > 0);

    return (
        <div className="relative pb-48">
             {!hasContent && renderEmptyState()}
            {groups.map((group, groupIndex) => (
                <div key={`${group.date}-${groupIndex}`} className="mb-8 animate-fade-in" style={{animationDelay: `${groupIndex * 100}ms`}}>
                    <h2 className="text-lg font-semibold text-gray-700 mb-4">{group.date}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {group.images.map((img, imgIndex) => (
                           <ImageCard 
                                key={img.id}
                                image={img}
                                groupIdx={groupIndex}
                                imageIdx={imgIndex}
                                onImageClick={onImageClick}
                                onDelete={() => onDeleteImage(groupIndex, imgIndex)}
                                onRename={() => {
                                    const newName = prompt('输入新的图片名称:', img.name);
                                    if (newName && newName.trim() !== '') {
                                        onRenameImage(groupIndex, imgIndex, newName.trim());
                                    }
                                }}
                           />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ImageGallery;