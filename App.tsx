/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateStyledImages, describeImageStyle, fileToGenerativePart } from './services/geminiService';
import Header from './components/Header';
import LeftSidebar from './components/LeftSidebar';
import ImageGallery from './components/ImageGallery';
import TrashGallery from './components/TrashGallery';
import PromptBar from './components/PromptBar';
import RegenerateModal from './components/RegenerateModal';
import InpaintEditor from './components/InpaintEditor';
import SaveStyleModal, { StyleModalData } from './components/SaveStyleModal';
import VipMode from './components/VipMode';
import { CloseIcon, SaveIcon, EditIcon, MagicWandIcon } from './components/icons';
import CircularProgress from './components/CircularProgress';

// --- Type Definitions ---
export type AspectRatio = '16:9' | '3:2' | '9:16';

export interface ImageItem {
    id: string;
    name: string;
    status: 'completed' | 'generating' | 'queued' | 'failed';
    url?: string;
    progress?: number;
    taskId?: string;
    styleDescription: string;
    contentPrompt: string;
    error?: string;
}

export interface ImageGroup {
    date: string;
    images: ImageItem[];
}

interface Task {
  id: string;
  contentPrompt: string;
  numImages: number;
  aspectRatio: AspectRatio;
  styleDescription?: string;
  referenceImageParts?: { inlineData: { mimeType: string; data: string; } }[];
}

export interface SavedStyle {
    name: string;
    thumbnailUrl: string;
    styleDescription: string;
    referenceImageParts?: { inlineData: { mimeType: string; data: string; } }[];
}

export interface ActiveStyle {
    name: string;
    styleDescription: string;
    images: {
        url: string;
        part: { inlineData: { mimeType: string; data: string; } };
        file?: File; // File is optional, might not exist for saved styles
    }[];
}


export interface LightboxData {
    id: string;
    url: string;
    name: string;
    styleDescription: string;
    contentPrompt: string;
}

// --- Custom Hook for Persistent State ---
function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        try {
            const storedValue = window.localStorage.getItem(key);
            return storedValue ? JSON.parse(storedValue) : defaultValue;
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    }, [key, state]);

    return [state, setState];
}


const App: React.FC = () => {
    // --- Common State ---
    const [error, setError] = useState<string | null>(null);
    const [lightboxData, setLightboxData] = useState<LightboxData | null>(null);

    // --- Task Queue State ---
    const [taskQueue, setTaskQueue] = useState<Task[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // --- Data State (with persistence) ---
    const [imageGroups, setImageGroups] = usePersistentState<ImageGroup[]>('heyphoto_imageGroups', []);
    const [savedStyles, setSavedStyles] = usePersistentState<SavedStyle[]>('heyphoto_savedStyles', []);
    const [trash, setTrash] = usePersistentState<ImageGroup[]>('heyphoto_trash', []);
    
    const [activeStyle, setActiveStyle] = useState<ActiveStyle | null>(null);
    const [activeView, setActiveView] = useState<'gallery' | 'trash'>('gallery');

    // --- Editor/Modal State ---
    const [regenerationData, setRegenerationData] = useState<LightboxData | null>(null);
    const [inpaintingImage, setInpaintingImage] = useState<LightboxData | null>(null);
    const [isSaveStyleModalOpen, setIsSaveStyleModalOpen] = useState(false);
    const [styleModalInitialData, setStyleModalInitialData] = useState<StyleModalData | null>(null);
    const [editingStyleIndex, setEditingStyleIndex] = useState<number | null>(null);

    // --- VIP Mode State ---
    const [isVipMode, setIsVipMode] = useState(false);

    const progressIntervals = useRef<Map<string, number>>(new Map());

    // --- Effects ---
    const updateImageStatus = (task_id: string, updates: Partial<ImageItem>) => {
        setImageGroups(prevGroups => prevGroups.map(group => ({
            ...group,
            images: group.images.map(img => img.taskId === task_id ? { ...img, ...updates } : img)
        })));
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setLightboxData(null);
                setRegenerationData(null);
                setInpaintingImage(null);
                setIsSaveStyleModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
      const processQueue = async () => {
          if (isProcessing || taskQueue.length === 0) return;

          setIsProcessing(true);
          const task = taskQueue[0];
          
          const startProgress = (taskId: string) => {
                updateImageStatus(taskId, { status: 'generating', progress: 0 });
                const intervalId = window.setInterval(() => {
                    setImageGroups(prevGroups => prevGroups.map(group => ({
                        ...group,
                        images: group.images.map(img => {
                            if (img.taskId === taskId && img.status === 'generating' && (img.progress ?? 0) < 95) {
                                const currentProgress = img.progress ?? 0;
                                const increment = Math.max(1, (95 - currentProgress) / 15);
                                return { ...img, progress: Math.min(currentProgress + increment, 95) };
                            }
                            return img;
                        })
                    })));
                }, 200);
                progressIntervals.current.set(taskId, intervalId);
          };

          const stopProgress = (taskId: string) => {
              const intervalId = progressIntervals.current.get(taskId);
              if (intervalId) {
                  clearInterval(intervalId);
                  progressIntervals.current.delete(taskId);
              }
              updateImageStatus(taskId, { progress: 100 });
              setTimeout(() => updateImageStatus(taskId, { progress: undefined }), 500);
          };
          
          try {
              setError(null);
              startProgress(task.id);

              const finalStyleDesc = task.styleDescription || 'cinematic photo, dramatic lighting, high detail, professional quality';

              const newImages = await generateStyledImages(
                finalStyleDesc, 
                task.contentPrompt, 
                task.numImages, 
                task.aspectRatio,
                task.referenceImageParts
              );

              setImageGroups(prevGroups => {
                  return prevGroups.map(group => ({
                      ...group,
                      images: group.images.map(img => {
                          if (img.taskId === task.id) {
                              const newImageData = newImages.pop();
                              if (newImageData) {
                                  return { 
                                    ...img, 
                                    status: 'completed' as const, 
                                    url: newImageData, 
                                    styleDescription: finalStyleDesc,
                                    name: task.contentPrompt.length > 40 ? task.contentPrompt.substring(0, 40) + '...' : task.contentPrompt,
                                  };
                              }
                          }
                          return img;
                      }).filter(img => img.status !== 'generating')
                  }));
              });

          } catch (err) {
              const errorMessage = err instanceof Error ? err.message : '发生未知错误。';
              setError(`任务 ${task.id.slice(0, 6)}... 失败: ${errorMessage}`);
              console.error(err);
              updateImageStatus(task.id, { status: 'failed', error: errorMessage });
          } finally {
              stopProgress(task.id);
              setTaskQueue(prevQueue => prevQueue.slice(1));
              setIsProcessing(false);
          }
      };
      processQueue();
    }, [taskQueue, isProcessing, setImageGroups]);

    const enqueueTask = (taskDetails: Omit<Task, 'id'>) => {
        const taskId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const newTask = { ...taskDetails, id: taskId };
        
        const today = new Date();
        const dateString = today.toLocaleDateString('zh-CN-u-nu-hanidec', { month: 'long', day: 'numeric', weekday: 'long' }).replace('月', '月 ');
        
        const placeholderImages: ImageItem[] = Array.from({ length: newTask.numImages }, (_, i) => ({
            id: `${taskId}-${i}`,
            name: `生成中...`,
            status: 'queued',
            taskId: taskId,
            styleDescription: '',
            contentPrompt: newTask.contentPrompt,
        }));

        setImageGroups(prev => {
            const todayGroupIndex = prev.findIndex(h => h.date === dateString);
            if (todayGroupIndex > -1) {
                const newGroups = [...prev];
                newGroups[todayGroupIndex].images.unshift(...placeholderImages);
                return newGroups;
            } else {
                return [{ date: dateString, images: placeholderImages }, ...prev];
            }
        });
        
        setTaskQueue(prevQueue => [...prevQueue, newTask]);
        setActiveStyle(null);
    };
    
    const handleDownload = useCallback((url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `HeyIt-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    const handleSaveStyleFromLightbox = useCallback((styleToSave: Omit<LightboxData, 'id'>) => {
        const styleName = prompt("为这个风格命名：", "我的风格");
        if (styleName && styleName.trim() !== "") {
            const newSavedStyle: SavedStyle = {
                name: styleName,
                thumbnailUrl: styleToSave.url,
                styleDescription: styleToSave.styleDescription
            };
            setSavedStyles(prev => [newSavedStyle, ...prev]);
            setLightboxData(null);
        }
    }, [setSavedStyles]);
    
    const handleOpenSaveStyleModal = useCallback(() => {
        setEditingStyleIndex(null); // Ensure we're creating, not editing
        const initialData: StyleModalData = {
            name: activeStyle?.name || '我的自定义风格',
            styleDescription: activeStyle?.styleDescription || '',
            initialImages: activeStyle?.images.map(img => ({
                file: img.file,
                url: img.url
            })).filter(img => !!img.file) ?? []
        };
        setStyleModalInitialData(initialData);
        setIsSaveStyleModalOpen(true);
    }, [activeStyle]);


    const handleFinalizeSaveStyle = useCallback(async (data: { name: string; styleDescription: string; images: { file?: File, url: string }[] }) => {
        if (!data.name.trim() || (!data.styleDescription.trim() && data.images.length === 0)) {
            setError("风格必须有名称以及描述或参考图。");
            return;
        }

        const imageParts = await Promise.all(
             data.images.map(async (img) => {
                if (img.file) {
                    return fileToGenerativePart(img.file);
                } else {
                    // Reconstruct part from data URL for existing images
                    const arr = img.url.split(',');
                    if (arr.length < 2) throw new Error("Invalid data URL");
                    const mimeMatch = arr[0].match(/:(.*?);/);
                    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
                    const mimeType = mimeMatch[1];
                    const base64Data = arr[1];
                    return { inlineData: { mimeType: mimeType, data: base64Data } };
                }
            })
        );
        
        const newThumbnail = data.images[0]?.url || `data:image/svg+xml;base64,${btoa(`<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#888" offset="0%"/><stop stop-color="#444" offset="100%"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g)"/></svg>`)}`

        if (editingStyleIndex !== null) {
            // Update existing style
            setSavedStyles(prev => {
                const newStyles = [...prev];
                newStyles[editingStyleIndex] = {
                    name: data.name.trim(),
                    styleDescription: data.styleDescription.trim(),
                    thumbnailUrl: newThumbnail,
                    referenceImageParts: imageParts
                };
                return newStyles;
            });
        } else {
            // Create new style
            const newSavedStyle: SavedStyle = {
                name: data.name.trim(),
                styleDescription: data.styleDescription.trim(),
                thumbnailUrl: newThumbnail,
                referenceImageParts: imageParts
            };
            setSavedStyles(prev => [newSavedStyle, ...prev]);
        }
        
        // Reset state
        setIsSaveStyleModalOpen(false);
        setStyleModalInitialData(null);
        setEditingStyleIndex(null);
        setActiveStyle(null);
    }, [setSavedStyles, editingStyleIndex]);


    const handleApplySavedStyle = useCallback((style: SavedStyle) => {
        const newActiveStyle: ActiveStyle = {
            name: style.name,
            styleDescription: style.styleDescription,
            images: style.referenceImageParts?.map(part => ({
                url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                part: part
            })) ?? []
        };
        setActiveStyle(newActiveStyle);
    }, []);

    const handleStyleImagesSelected = useCallback(async (files: File[]) => {
        setError(null);
        const newImagesData: { url: string; part: { inlineData: { mimeType: string; data: string; } }; file: File }[] = [];

        try {
            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    setError('请上传有效的图片文件。');
                    continue;
                }
                const tempUrl = URL.createObjectURL(file);
                const imagePart = await fileToGenerativePart(file);
                newImagesData.push({ url: tempUrl, part: imagePart, file });
            }

            // If this is the first image being added, analyze its style.
            let styleDescription = activeStyle?.styleDescription || '';
            if ((!activeStyle || activeStyle.images.length === 0) && newImagesData.length > 0) {
                 setActiveStyle(prev => ({
                    name: `来自 ${files[0].name} 的风格`,
                    styleDescription: '正在从图片分析风格...',
                    images: [...(prev?.images || []), ...newImagesData]
                }));
                
                styleDescription = await describeImageStyle(files[0]);
            }
            
            setActiveStyle(prev => {
                const base = prev || { name: `来自 ${files[0].name} 的风格`, styleDescription: '', images: [] };
                return {
                    ...base,
                    styleDescription: styleDescription || base.styleDescription,
                    images: [...base.images, ...newImagesData]
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '分析或处理图片失败。';
            setError(errorMessage);
            console.error(err);
            // Don't null out activeStyle, just report error
        }

    }, [activeStyle]);

    const handleRemoveStyleImage = useCallback((indexToRemove: number) => {
        setActiveStyle(prev => {
            if (!prev) return null;
            const newImages = prev.images.filter((_, index) => index !== indexToRemove);
            if (newImages.length === 0 && !prev.styleDescription) {
                return null;
            }
            return { ...prev, images: newImages };
        });
    }, []);


    const handleRenameImage = (groupIdx: number, imageIdx: number, newName: string) => {
        setImageGroups(prevGroups => {
            const newGroups = [...prevGroups];
            const image = newGroups[groupIdx]?.images[imageIdx];
            if (image) {
                image.name = newName;
            }
            return newGroups;
        });
    };

    const handleDeleteImage = (groupIdx: number, imageIdx: number) => {
        let imageToMove: ImageItem;
        const newImageGroups = imageGroups.map((group, gIdx) => {
            if (gIdx !== groupIdx) return group;
            const newImages = group.images.filter((img, iIdx) => {
                if (iIdx === imageIdx) {
                    imageToMove = img;
                    return false;
                }
                return true;
            });
            return { ...group, images: newImages };
        }).filter(group => group.images.length > 0);

        setImageGroups(newImageGroups);
        
        // @ts-ignore
        if (imageToMove) {
            setTrash(prevTrash => {
                const today = new Date();
                const dateString = "删除于 " + today.toLocaleDateString('zh-CN');
                const todayTrashGroup = prevTrash.find(g => g.date === dateString);
                if (todayTrashGroup) {
                    return prevTrash.map(g => g.date === dateString ? {...g, images: [imageToMove, ...g.images]} : g);
                } else {
                    return [{ date: dateString, images: [imageToMove] }, ...prevTrash];
                }
            });
        }
    };

    const handleRestoreImage = (trashGroupIdx: number, imageIdx: number) => {
        let imageToRestore: ImageItem;
        const newTrash = trash.map((group, gIdx) => {
            if (gIdx !== trashGroupIdx) return group;
            const newImages = group.images.filter((img, iIdx) => {
                if (iIdx === imageIdx) {
                    imageToRestore = img;
                    return false;
                }
                return true;
            });
            return { ...group, images: newImages };
        }).filter(group => group.images.length > 0);

        setTrash(newTrash);

        // @ts-ignore
        if (imageToRestore) {
            const today = new Date();
            const dateString = today.toLocaleDateString('zh-CN-u-nu-hanidec', { month: 'long', day: 'numeric', weekday: 'long' }).replace('月', '月 ');

            setImageGroups(prev => {
                const todayGroupIndex = prev.findIndex(h => h.date === dateString);
                if (todayGroupIndex > -1) {
                    const newGroups = [...prev];
                    newGroups[todayGroupIndex].images.unshift(imageToRestore);
                    return newGroups;
                } else {
                    return [{ date: dateString, images: [imageToRestore] }, ...prev];
                }
            });
        }
    };

    const handlePermanentlyDeleteImage = (trashGroupIdx: number, imageIdx: number) => {
        const newTrash = trash.map((group, gIdx) => {
            if (gIdx !== trashGroupIdx) return group;
            return { ...group, images: group.images.filter((_, iIdx) => iIdx !== imageIdx) };
        }).filter(group => group.images.length > 0);
        setTrash(newTrash);
    };

    const addInpaintedImage = (newImageUrl: string, originalImage: LightboxData) => {
        const newImageItem: ImageItem = {
            id: `inpainted-${Date.now()}`,
            name: `编辑: ${originalImage.name}`,
            status: 'completed',
            url: newImageUrl,
            styleDescription: originalImage.styleDescription,
            contentPrompt: `局部修改: ${originalImage.contentPrompt}`,
        };
        const today = new Date();
        const dateString = today.toLocaleDateString('zh-CN-u-nu-hanidec', { month: 'long', day: 'numeric', weekday: 'long' }).replace('月', '月 ');

        setImageGroups(prev => {
            const todayGroupIndex = prev.findIndex(h => h.date === dateString);
            if (todayGroupIndex > -1) {
                const newGroups = [...prev];
                newGroups[todayGroupIndex].images.unshift(newImageItem);
                return newGroups;
            } else {
                return [{ date: dateString, images: [newImageItem] }, ...prev];
            }
        });
        setInpaintingImage(null);
    };

     // --- Style Management Handlers ---
    const handleOpenEditStyleModal = useCallback((index: number) => {
        const styleToEdit = savedStyles[index];
        if (!styleToEdit) return;

        setEditingStyleIndex(index);
        
        const initialImages = styleToEdit.referenceImageParts?.map(part => ({
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            file: undefined, // File object is not available for saved styles
        })) ?? [];

        const initialData: StyleModalData = {
            name: styleToEdit.name,
            styleDescription: styleToEdit.styleDescription,
            initialImages: initialImages
        };
        setStyleModalInitialData(initialData);
        setIsSaveStyleModalOpen(true);
    }, [savedStyles]);
    
    const handleRenameStyle = useCallback((index: number) => {
        const styleToRename = savedStyles[index];
        if (!styleToRename) return;
        const newName = prompt("输入新的风格名称：", styleToRename.name);
        if (newName && newName.trim() !== "") {
            setSavedStyles(prev => {
                const newStyles = [...prev];
                newStyles[index] = { ...newStyles[index], name: newName.trim() };
                return newStyles;
            });
        }
    }, [savedStyles, setSavedStyles]);

    const handleDeleteStyle = useCallback((index: number) => {
        const styleToDelete = savedStyles[index];
        if (!styleToDelete) return;
        if (confirm(`确定要删除风格 "${styleToDelete.name}" 吗？此操作无法撤销。`)) {
            setSavedStyles(prev => prev.filter((_, i) => i !== index));
        }
    }, [savedStyles, setSavedStyles]);

    // --- Render Functions ---
    const renderLightbox = () => {
        if (!lightboxData) return null;
        return (
            <div 
              className="fixed inset-0 bg-gray-900/20 backdrop-blur-xl z-50 flex items-center justify-center animate-fade-in"
              onClick={() => setLightboxData(null)}
            >
                <div className="relative w-full h-full flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
                    <img src={lightboxData.url} alt="放大预览" className="object-contain max-w-[95vw] max-h-[95vh] rounded-lg shadow-2xl" />
                    
                    <button onClick={() => setLightboxData(null)} className="absolute top-4 right-4 bg-white/50 text-black rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:scale-110 hover:bg-white/80 transition-all" aria-label="关闭预览">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                    
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                        <button 
                            onClick={() => handleSaveStyleFromLightbox(lightboxData)} 
                            className="flex items-center gap-2 bg-white/50 backdrop-blur-md border border-black/10 text-black font-semibold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out shadow-lg hover:bg-white/80 hover:-translate-y-px active:scale-95"
                        >
                            <SaveIcon className="w-5 h-5" />
                            保存风格
                        </button>
                         <button 
                            onClick={() => { setRegenerationData(lightboxData); setLightboxData(null); }} 
                            className="flex items-center gap-2 bg-white/50 backdrop-blur-md border border-black/10 text-black font-semibold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out shadow-lg hover:bg-white/80 hover:-translate-y-px active:scale-95"
                        >
                            <EditIcon className="w-5 h-5" />
                            修改提示词
                        </button>
                        <button 
                            onClick={() => { setInpaintingImage(lightboxData); setLightboxData(null); }} 
                            className="flex items-center gap-2 bg-white/50 backdrop-blur-md border border-black/10 text-black font-semibold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out shadow-lg hover:bg-white/80 hover:-translate-y-px active:scale-95"
                        >
                            <MagicWandIcon className="w-5 h-5" />
                            局部修改
                        </button>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                         <button 
                            onClick={() => handleDownload(lightboxData.url)} 
                            className="bg-white/50 backdrop-blur-md border border-black/10 text-black font-bold py-5 px-10 rounded-xl transition-all duration-300 ease-in-out shadow-lg hover:bg-white/80 hover:-translate-y-1 active:scale-95 text-xl pointer-events-auto"
                        >
                            下载图片
                        </button>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 bg-white/60 backdrop-blur-md p-3 rounded-lg max-h-24 overflow-y-auto hover:max-h-60 transition-all duration-300 group cursor-pointer border border-black/10">
                        <p className="text-gray-800 text-sm whitespace-pre-wrap break-words">
                            <strong className="text-black font-semibold">提示词:</strong> {lightboxData.contentPrompt}
                        </p>
                        <p className="text-gray-600 text-xs whitespace-pre-wrap break-words mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <strong className="text-gray-700 font-semibold">风格:</strong> {lightboxData.styleDescription}
                        </p>
                    </div>
                </div>
            </div>
        );
    };
    
    if (inpaintingImage) {
        return <InpaintEditor image={inpaintingImage} onComplete={(newUrl) => addInpaintedImage(newUrl, inpaintingImage)} onClose={() => setInpaintingImage(null)} />
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            {renderLightbox()}
            {regenerationData && (
                <RegenerateModal
                    isOpen={!!regenerationData}
                    onClose={() => setRegenerationData(null)}
                    originalData={regenerationData}
                    onSubmit={(newPrompt) => {
                        enqueueTask({
                            contentPrompt: newPrompt,
                            styleDescription: regenerationData.styleDescription,
                            numImages: 2, // Default or carry over
                            aspectRatio: '16:9', // Default or carry over
                        });
                        setRegenerationData(null);
                    }}
                />
            )}
            <SaveStyleModal 
                isOpen={isSaveStyleModalOpen}
                onClose={() => setIsSaveStyleModalOpen(false)}
                onSave={handleFinalizeSaveStyle}
                initialData={styleModalInitialData}
            />
            
            <Header onToggleVipMode={() => setIsVipMode(prev => !prev)} isVipMode={isVipMode} />

            {isVipMode ? (
                <VipMode />
            ) : (
                <>
                    <div className="flex flex-1 overflow-hidden">
                        <LeftSidebar 
                            savedStyles={savedStyles} 
                            onApplyStyle={handleApplySavedStyle} 
                            activeStyleName={activeStyle?.name ?? null}
                            trashCount={trash.reduce((acc, group) => acc + group.images.length, 0)}
                            activeView={activeView}
                            onViewChange={setActiveView}
                            onEditStyle={handleOpenEditStyleModal}
                            onRenameStyle={handleRenameStyle}
                            onDeleteStyle={handleDeleteStyle}
                        />
                        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                            {activeView === 'gallery' ? (
                                <ImageGallery
                                    groups={imageGroups}
                                    onImageClick={setLightboxData}
                                    onDeleteImage={handleDeleteImage}
                                    onRenameImage={handleRenameImage}
                                />
                            ) : (
                                <TrashGallery
                                    groups={trash}
                                    onRestoreImage={handleRestoreImage}
                                    onPermanentlyDeleteImage={handlePermanentlyDeleteImage}
                                />
                            )}
                        </main>
                    </div>
                    
                    <PromptBar
                      onGenerate={enqueueTask}
                      isProcessing={isProcessing}
                      queueLength={taskQueue.length}
                      activeStyle={activeStyle}
                      onClearStyle={() => setActiveStyle(null)}
                      onOpenSaveStyle={handleOpenSaveStyleModal}
                      onStyleImagesSelected={handleStyleImagesSelected}
                      onRemoveStyleImage={handleRemoveStyleImage}
                    />
                </>
            )}
        </div>
    );
};

export default App;