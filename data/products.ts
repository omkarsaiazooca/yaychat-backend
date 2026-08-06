export interface Product {
  name: string;
  slug: string;
  description: string;
  type_id: number;
  price: number;
  shop_id: number;
  sale_price: number;
  language: string;
  min_price: number;
  max_price: number;
  sku: string;
  quantity: number;
  in_stock: number;
  is_taxable: number;
  shipping_class_id: number | null;
  status: string;
  product_type: string;
  unit: string;
  height: number | null;
  width: number | null;
  length: number | null;
  image: Image;
  video: string | null;
  gallery: Image[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  author_id: number | null;
  manufacturer_id: number | null;
  is_digital: number;
  is_external: number;
  external_product_url: string | null;
  external_product_button_text: string | null;
  ratings: number;
  total_reviews: number;
  rating_count: RatingCount[];
  my_review: string | null;
  in_wishlist: boolean;
  blocked_dates: any[];
  translated_languages: string[];
  categories: Category[];
  shop: Shop;
  type: ProductType;
  variations: any[];
  metas: any[];
  manufacturer: any | null;
  variation_options: any[];
  tags: any[];
  author: any | null;
}

interface Image {
  id: string;
  original: string;
  thumbnail: string;
}

interface RatingCount {
  rating: number;
  total: number;
  positive_feedbacks_count: number;
  negative_feedbacks_count: number;
  my_feedback: string | null;
  abusive_reports_count: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  language: string;
  image: any[];
  details: string | null;
  parent: number | null;
  type_id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  parent_id: number | null;
  translated_languages: string[];
  pivot: Pivot;
}

interface Pivot {
  product_id: number;
  category_id: number;
}

interface Shop {
  id: number;
  owner_id: number;
  name: string;
  slug: string;
  description: string;
  cover_image: Image;
  logo: Image;
  is_active: number;
  address: Address;
  settings: ShopSettings;
  created_at: string;
  updated_at: string;
}

interface Address {
  zip: string;
  city: string;
  state: string;
  country: string;
  street_address: string;
}

interface ShopSettings {
  contact: string;
  socials: Social[];
  website: string;
  location: Location;
}

interface Social {
  url: string;
  icon: string;
}

interface Location {
  lat: number;
  lng: number;
  city: string;
  state: string;
  country: string;
  formattedAddress: string;
}

interface ProductType {
  id: number;
  name: string;
  settings: ProductTypeSettings;
  slug: string;
  language: string;
  icon: string;
  promotional_sliders: Image[];
  created_at: string;
  updated_at: string;
  translated_languages: string[];
}

interface ProductTypeSettings {
  isHome: boolean;
  layoutType: string;
  productCard: string;
}
