export interface Image {
  id: string | null;
  original: string | null;
  thumbnail: string | null;
}

export interface TypeSettings {
  isHome: boolean;
  layoutType: string;
  productCard: string;
}

export interface Type {
  id: number;
  name: string;
  language: string;
  translated_languages: string[];
  settings: TypeSettings;
  slug: string;
  icon: string;
  promotional_sliders: Image[];
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  name: string;
  slug: string;
  icon: string | null;
  image: Image[] | Image;
  details: string | null;
  language: string;
  translated_languages: string[];
  parent: Category | null;
  type_id: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: string | null;
  parent_id: number | null;
  type: Type | null;
  children: any[] | null;
  products_count?: number;
}
