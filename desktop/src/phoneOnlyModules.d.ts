// These packages exist only in the phone app. Some shared core files (paperFiles
// and its unreachable chain) name them at the top; desktop never calls into
// those paths, and vite replaces the same specifiers with the phone's test
// stubs. These declarations mirror the shapes paperFiles.ts uses so desktop's
// tsc stays green without the phone's node_modules.
declare module "react-native" {
  export const Platform: { OS: string };
}

declare module "expo-file-system" {
  export class File {
    constructor(...args: unknown[]);
    uri: string;
    exists: boolean;
    create(options?: unknown): void;
    delete(): void;
    copySync(destination: unknown): void;
  }
  export class Directory {
    constructor(...args: unknown[]);
    uri: string;
    exists: boolean;
    create(options?: unknown): void;
    delete(): void;
  }
  export const Paths: { document: Directory; cache: Directory };
}

declare module "expo-file-system/legacy" {
  export const EncodingType: { Base64: string; UTF8: string };
  export function readAsStringAsync(uri: string, options?: { encoding?: string }): Promise<string>;
}

declare module "expo-document-picker" {
  export interface DocumentPickerAsset {
    uri: string;
    mimeType?: string;
    name?: string;
  }
  export interface DocumentPickerResult {
    canceled: boolean;
    assets: DocumentPickerAsset[];
  }
  export function getDocumentAsync(options?: unknown): Promise<DocumentPickerResult>;
}

declare module "expo-image-picker" {
  export interface ImagePickerAsset {
    uri: string;
    base64: string;
  }
  export interface ImagePickerResult {
    canceled: boolean;
    assets: ImagePickerAsset[];
  }
  export function requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
  export function launchImageLibraryAsync(options?: unknown): Promise<ImagePickerResult>;
}
