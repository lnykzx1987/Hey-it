/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

// Declare global variables from CDN scripts
declare const mammoth: any;

// Helper function to convert a File object to a Gemini API Part
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

/**
 * Describes the visual style of an image using a generative AI model.
 * @param imageFile The image file to analyze.
 * @returns A promise that resolves to a text description of the image's style.
 */
export const describeImageStyle = async (imageFile: File): Promise<string> => {
    console.log('Describing image style.');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const imagePart = await fileToGenerativePart(imageFile);
    
    const prompt = `Analyze the provided image and describe its artistic style in a concise, descriptive paragraph. Focus on elements like lighting, color palette, composition, texture, and overall mood. The description should be suitable for prompting an AI image generator to replicate this style. For example: "A cinematic, low-key photograph with dramatic chiaroscuro lighting. Features a desaturated color palette with deep shadows and warm, selective highlights. The composition is tight and intimate, creating a moody and introspective atmosphere." Do not describe the content of the image, only the style.`;
    
    const textPart = { text: prompt };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
    });

    console.log('Received style description from model.', response);
    const description = response.text?.trim();

    if (!description) {
        throw new Error('分析图片风格失败。模型没有返回描述。');
    }
    
    return description;
};

/**
 * Generates an edited image using generative AI based on a text prompt and a mask image.
 * @param originalImage The original image file.
 * @param maskImage The mask image file (white areas to be edited, black areas to be preserved).
 * @param userPrompt The text prompt describing the desired edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateEditedImage = async (
    originalImage: File,
    maskImage: File,
    userPrompt: string,
): Promise<string> => {
    console.log('Starting generative edit with mask using nano-banana.');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToGenerativePart(originalImage);
    const maskImagePart = await fileToGenerativePart(maskImage);
    const textPart = { text: userPrompt };

    console.log('Sending image, mask, and prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, maskImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    console.log('Received response from model.', response);

    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `请求被阻止。原因: ${blockReason}。${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for edit`);
        return `data:${mimeType};base64,${data}`;
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `为 "编辑" 生成图片时意外停止。原因: ${finishReason}。这通常与安全设置有关。`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    const textFeedback = response.text?.trim();
    const errorMessage = `AI 模型没有为 "编辑" 返回图片。` + 
        (textFeedback 
            ? `模型返回了文本：“${textFeedback}”`
            : "这可能是由于安全过滤器或请求过于复杂。请尝试更直接地改写您的提示。");

    console.error(`Model response did not contain an image part for edit.`, { response });
    throw new Error(errorMessage);
};

/**
 * Generates new images based on a style description and a content prompt.
 * Uses 'gemini-2.5-flash-image-preview' if a reference image is provided for style transfer.
 * Uses 'imagen-4.0-generate-001' for higher quality text-to-image generation.
 * @param styleDescription Text description of the desired artistic style.
 * @param userPrompt Text description of the desired image content.
 * @param numberOfImages The number of images to generate.
 * @param aspectRatio The desired aspect ratio for the images.
 * @param referenceImageParts An optional array of reference image parts for style transfer.
 * @returns A promise that resolves to an array of base64 data URLs for the generated images.
 */
export const generateStyledImages = async (
    styleDescription: string,
    userPrompt: string,
    numberOfImages: number,
    aspectRatio: '16:9' | '3:2' | '9:16',
    referenceImageParts?: { inlineData: { mimeType: string; data: string } }[]
): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    if (referenceImageParts && referenceImageParts.length > 0) {
        // --- Path 1: Image + Text (Style Replication) ---
        console.log(`Generating ${numberOfImages} images with 'gemini-2.5-flash-image-preview' using reference images.`);
        const combinedPrompt = `Synthesize the artistic styles from ALL of the provided reference images. The key stylistic elements are described as: "${styleDescription}". Use this synthesized style to create a new image depicting: "${userPrompt}"`;
        const textPart = { text: combinedPrompt };
        const parts = [...referenceImageParts, textPart];
        const generatedImages: string[] = [];

        for (let i = 0; i < numberOfImages; i++) {
            // Add a delay before each call after the first one to avoid rate limiting.
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
            
            console.log(`Generating image ${i + 1} of ${numberOfImages}...`);
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: parts },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
            });

            if (response.promptFeedback?.blockReason) {
                throw new Error(`请求被阻止: ${response.promptFeedback.blockReason}`);
            }
            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                generatedImages.push(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
            } else {
                 console.warn(`Image ${i + 1} generation did not return an image part. Finish reason: ${response.candidates?.[0]?.finishReason}`);
            }
        }

        if (generatedImages.length === 0) {
            throw new Error('AI模型未能生成任何图片。这可能是由于安全设置或请求无效。');
        }
        return generatedImages;

    } else {
        // --- Path 2: Text Only (High Quality) ---
        console.log(`Generating ${numberOfImages} images with 'imagen-4.0-generate-001'.`);
        const fullPrompt = `${styleDescription}, ${userPrompt}`;

        const mapAspectRatio = (ar: '16:9' | '3:2' | '9:16'): '16:9' | '4:3' | '9:16' => {
            if (ar === '16:9') return '16:9';
            if (ar === '9:16') return '9:16';
            if (ar === '3:2') return '4:3'; // Map 3:2 to the supported 4:3
            return '16:9'; // Default
        };

        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: fullPrompt,
            config: {
              numberOfImages: numberOfImages,
              outputMimeType: 'image/jpeg',
              aspectRatio: mapAspectRatio(aspectRatio),
            },
        });
        
        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error('AI模型未能生成任何图片。这可能是由于安全设置或请求无效。');
        }

        return response.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
    }
};

/**
 * Extracts text content from a supported file type (.txt, .docx).
 * @param file The file to process.
 * @returns A promise that resolves to the extracted text content.
 */
export const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === 'text/plain') {
        return file.text();
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                if (!event.target?.result) {
                    return reject('无法读取文件');
                }
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer: event.target.result as ArrayBuffer });
                    resolve(result.value);
                } catch (error) {
                    console.error("Mammoth error:", error);
                    reject('解析 .docx 文件失败');
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    throw new Error('不支持的文件类型。请使用 .txt 或 .docx 文件。');
};


/**
 * Analyzes a long text document and extracts a list of image generation prompts with names.
 * @param documentText The text content of the document.
 * @returns A promise that resolves to an array of objects, each with a name and a prompt.
 */
export const analyzeDocumentForImagePrompts = async (documentText: string): Promise<{name: string, prompt: string}[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const prompt = `Analyze the following text and break it down into a list of distinct, self-contained image generation prompts. For each prompt, also extract a short, unique identifier from the text that looks like 'BG-XX-XX'. If no such identifier is present for a prompt, generate a simple one like 'Image-1', 'Image-2'. Return ONLY a JSON object that strictly follows this schema: an object with a key "prompts" which contains an array of objects, where each object has a "name" (the identifier) and a "prompt" (the detailed instruction). Do not add any commentary or explanation outside the JSON object.

    Document Text:
    ---
    ${documentText}
    ---
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    prompts: {
                        type: Type.ARRAY,
                        items: { 
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "An identifier for the image, e.g., BG-01-01."},
                                prompt: { type: Type.STRING, description: "A detailed image generation prompt." }
                            },
                            required: ["name", "prompt"],
                         }
                    }
                },
                required: ["prompts"]
            },
        },
    });

    try {
        let jsonStr = response.text.trim();
        // The model might still wrap the JSON in markdown, so we need to extract it.
        const jsonMatch = jsonStr.match(/```(json)?\s*([\s\S]+?)\s*```/);
        if (jsonMatch && jsonMatch[2]) {
            jsonStr = jsonMatch[2];
        }

        const result = JSON.parse(jsonStr);
        if (result && Array.isArray(result.prompts)) {
            // Filter out any empty prompts that the model might generate
            return result.prompts.filter((p: any) => 
                p && typeof p === 'object' && 
                typeof p.name === 'string' && p.name.trim() !== '' &&
                typeof p.prompt === 'string' && p.prompt.trim() !== ''
            );
        }
        console.warn('Parsed JSON but prompts array is missing or invalid.', result);
        throw new Error('AI返回了无效的JSON结构。');
    } catch (e) {
        console.error("解析来自模型的JSON失败:", response.text, e);
        throw new Error("分析文档失败。AI返回了无效的格式。");
    }
};


/**
 * Translates a list of prompts to English.
 * @param prompts An array of prompt strings to translate.
 * @returns A promise that resolves to an array of translated English prompts.
 */
export const translatePromptsToEnglish = async (prompts: string[]): Promise<string[]> => {
    if (prompts.length === 0) return [];
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    // Use a unique separator that's unlikely to appear in prompts
    const separator = "|||---|||"; 
    const combinedText = prompts.join(separator);

    const prompt = `Translate the following list of creative prompts from Chinese to English. The prompts are separated by "${separator}". Maintain the original meaning and creative intent of each prompt. Return the translated prompts separated by the exact same separator. Do not add any other text or explanation.

    Prompts:
    ${combinedText}`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });

    const translatedText = response.text.trim();
    const translatedPrompts = translatedText.split(separator);

    if (translatedPrompts.length !== prompts.length) {
        console.error("Translation mismatch: input count and output count are different.", {
            originalCount: prompts.length,
            translatedCount: translatedPrompts.length,
            response: translatedText,
        });
        // Fallback to original prompts on failure
        return prompts; 
    }

    return translatedPrompts;
};