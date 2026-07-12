export type Category =
  | 'Siyaset'
  | 'Ekonomi'
  | 'Dış Politika'
  | 'Güvenlik'
  | 'Teknoloji'
  | 'Sağlık'
  | 'Çevre'
  | 'Eğitim'
  | 'Spor'
  | 'Afet'
  | 'Resmî Gazete';

export type SourceKind = 'statement' | 'tweet' | 'press' | 'video' | 'image';
export type SourceLean =
  | 'iktidar'
  | 'muhalefet'
  | 'devlet_kurumu'
  | 'ajans'
  | 'yabanci';

export interface EventSource {
  id: string;
  kind: SourceKind;
  author: string;
  role: string;
  timestamp: string;
  body: string;
  /** Verbatim short quote from the source's own text (LLM-extracted). */
  quote?: string;
  url?: string;
  linkLabel?: string;
  lean?: SourceLean;
}

export interface StoryStep {
  id: string;
  date: string;
  relative: string;
  headline: string;
  detail: string;
}

export interface AgendaEvent {
  id: string;
  category: Category;
  kicker: string;
  title: string;
  summary: string;
  updatedAt: string;
  readSeconds: number;
  sources: EventSource[];
  story: StoryStep[];
  imageUrl?: string;
  context: {
    current: string;
    howWeGotHere: string;
    actors: string[];
    nextDate?: string;
  };
}

export const CATEGORIES: Category[] = [
  'Siyaset',
  'Ekonomi',
  'Dış Politika',
  'Güvenlik',
  'Teknoloji',
  'Sağlık',
  'Çevre',
  'Eğitim',
  'Spor',
  'Afet',
  'Resmî Gazete',
];
