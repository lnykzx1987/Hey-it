/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ImagesIcon, VideosIcon, TrashIcon, EditIcon, DeleteIcon, RenameIcon } from './icons';
import { SavedStyle } from '../App';

interface LeftSidebarProps {
    savedStyles: SavedStyle[];
    onApplyStyle: (style: SavedStyle) => void;
    trashCount: number;
    activeStyleName: string | null;
    activeView: 'gallery' | 'trash';
    onViewChange: (view: 'gallery' | 'trash') => void;
    onEditStyle: (index: number) => void;
    onRenameStyle: (index: number) => void;
    onDeleteStyle: (index: number) => void;
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-2">{children}</h3>
);

const LeftSidebar: React.FC<LeftSidebarProps> = ({ savedStyles, onApplyStyle, trashCount, activeStyleName, activeView, onViewChange, onEditStyle, onRenameStyle, onDeleteStyle }) => {
    return (
        <aside className="hidden md:flex flex-col w-72 bg-white/60 border-r border-gray-200 p-4 shrink-0">
            <div className="flex-1 space-y-1">
                <SectionTitle>类别</SectionTitle>
                <button onClick={() => onViewChange('gallery')} className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeView === 'gallery' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900'}`}>
                    <div className="flex items-center gap-3">
                        <ImagesIcon className="w-5 h-5" />
                        <span>图片</span>
                    </div>
                </button>
                 <div className="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-gray-400 cursor-not-allowed">
                    <div className="flex items-center gap-3">
                        <VideosIcon className="w-5 h-5" />
                        <span>视频</span>
                    </div>
                    <span className="text-xs font-semibold bg-gray-200 text-gray-500 rounded-md px-2 py-0.5">即将推出</span>
                </div>

                <SectionTitle>风格</SectionTitle>
                <div className="space-y-2">
                    {savedStyles.map((style, index) => {
                         const isActive = activeStyleName === style.name;
                         return (
                            <div key={`${style.name}-${index}`} className={`relative group`}>
                                <button 
                                    onClick={() => onApplyStyle(style)} 
                                    className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-200/50 transition-colors text-left ${isActive ? 'bg-blue-500/10 ring-2 ring-blue-500' : ''}`}
                                >
                                    <img src={style.thumbnailUrl} alt={style.name} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                                    <div className="flex-1 overflow-hidden">
                                        <p className={`text-sm ${isActive ? 'text-blue-800' : 'text-gray-700'} group-hover:text-gray-900 truncate`}>{style.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{style.styleDescription || "基于图片的风格"}</p>
                                    </div>
                                </button>
                                <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={(e) => {e.stopPropagation(); onEditStyle(index)}} className="p-1.5 rounded-full bg-gray-300/50 hover:bg-gray-300 text-gray-700 hover:text-black" aria-label="编辑风格">
                                        <EditIcon className="w-4 h-4"/>
                                    </button>
                                    <button onClick={(e) => {e.stopPropagation(); onRenameStyle(index)}} className="p-1.5 rounded-full bg-gray-300/50 hover:bg-gray-300 text-gray-700 hover:text-black" aria-label="重命名风格">
                                        <RenameIcon className="w-4 h-4"/>
                                    </button>
                                    <button onClick={(e) => {e.stopPropagation(); onDeleteStyle(index)}} className="p-1.5 rounded-full bg-gray-300/50 hover:bg-red-500 text-gray-700 hover:text-white" aria-label="删除风格">
                                        <DeleteIcon className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                         )
                    })}
                </div>
            </div>

            <div className="mt-auto space-y-1">
                 <button onClick={() => onViewChange('trash')} className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeView === 'trash' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900'}`}>
                    <div className="flex items-center gap-3">
                        <TrashIcon className="w-5 h-5" />
                        <span>垃圾箱</span>
                    </div>
                    {trashCount > 0 && <span className="text-xs font-mono bg-gray-300 text-gray-700 rounded-full px-2 py-0.5">{trashCount}</span>}
                </button>
            </div>
        </aside>
    );
};

export default LeftSidebar;