

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: 'Nigeria' | 'Diaspora' | 'Culture' | 'Economy' | 'Listener Report' | 'Sports' | 'Global' | 'Politics' | 'Business' | 'Security' | 'Technology' | 'Breaking' | 'TV' | 'Social' | 'Manual';
  timestamp: number;
  location?: string;
  sources?: string[];
  isVerified?: boolean;
  priority?: number;
  summary?: string;
  source?: string;
}

export interface MediaFile {
  id: string;
  name: string;
  url: string; // This will hold the Object URL in-memory
  file?: File | Blob; // The persistent binary data
  type: 'audio' | 'video' | 'image';
  category?: string; // e.g., 'adverts', 'music', 'stinger'
  timestamp: number;
  likes?: number;
}

export interface AdminMessage {
  id: string;
  text: string;
  timestamp: number;
}

export interface DjScript {
  id: string;
  script: string;
  audioData?: string;
  timestamp: number;
}

export interface AdminLog {
  id: string;
  action: string;
  timestamp: number;
}

export interface ListenerReport {
  id: string;
  reporterName: string;
  location: string;
  content: string;
  timestamp: number;
}

export enum UserRole {
  LISTENER = 'LISTENER',
  ADMIN = 'ADMIN'
}
