export type ArchiveFileCategory = 'doc' | 'sheet' | 'slide' | 'image' | 'design' | 'media' | 'other';
export type ArchiveImageCategory = 'photo' | 'poster' | 'logo' | null;

export interface ArchiveItem {
  id: string;
  name: string;
  rawName: string;
  relPath: string;
  year: string;
  project: string;
  subFolder: string;
  ext: string;
  category: ArchiveFileCategory;
  size: number;
  date: string;
  mtime: number;
  snippet: string;
  keywords: string[];
  imageCategory: ArchiveImageCategory;
  score?: number;
  matchReason?: 'filename' | 'content' | 'synonym' | 'context';
}

export interface ArchiveFacets {
  years: Record<string, number>;
  projects: Record<string, number>;
  categories: Record<string, number>;
}

export interface ArchiveSearchResponse {
  generatedAt: string;
  totalIndexed: number;
  totalMatched: number;
  facets: ArchiveFacets;
  items: ArchiveItem[];
  cluster?: {
    anchor: ArchiveItem;
    docs: ArchiveItem[];
    sheets: ArchiveItem[];
    images: ArchiveItem[];
  } | null;
}
