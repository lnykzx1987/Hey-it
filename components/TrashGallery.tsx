/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ImageGroup, ImageItem } from '../App';
import { DeleteIcon, RestoreIcon, TrashIcon } from './icons';

interface TrashGalleryProps {
    groups: ImageGroup[];
    onRestoreImage: (groupIdx: number, imageIdx: number) => void;
    onPermanentlyDeleteImage: (groupIdx: number, imageIdx: number) => void;
}

const TrashCard: React.FC<{
    image: ImageItem;
    onRestore: () => void;
    onDelete: () => void;
}> = ({ image, onRestore, onDelete }) => {
    return (
        <div className="relative group aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <img src={image.url} alt={image.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pointer-events-none">
                <p className="text-white text-sm p-2 truncate">{image.name}</p>
            </div>
            <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onRestore(); }} className="bg-black/50 hover:bg-green-600 text-white rounded-md p-1.5 transition-colors" aria-label="恢复图片">
                    <RestoreIcon className="w-4 h-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-black/50 hover:bg-red-600 text-white rounded-md p-1.5 transition-colors" aria-label="永久删除">
                    <DeleteIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
};

const TrashGallery: React.FC<TrashGalleryProps> = ({ groups, onRestoreImage, onPermanentlyDeleteImage }) => {

    const renderEmptyState = () => (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-gray-500 p-8">
            <TrashIcon className="w-16 h-16 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-800">垃圾箱是空的</h2>
            <p className="mt-2 max-w-md text-gray-600">
                删除的图片会出现在这里。
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
                           <TrashCard 
                                key={img.id}
                                image={img}
                                onRestore={() => onRestoreImage(groupIndex, imgIndex)}
                                onDelete={() => {
                                    if (confirm('确定要永久删除这张图片吗？此操作无法撤销。')) {
                                        onPermanentlyDeleteImage(groupIndex, imgIndex);
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

export default TrashGallery;