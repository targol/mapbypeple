import React from 'react';
import {
  BookOpen,
  Building2,
  Camera,
  Compass,
  Droplets,
  Feather,
  Flame,
  Flower2,
  Home,
  Landmark,
  Layers,
  MapPin,
  Mountain,
  Music,
  Route,
  Sparkles,
  Trees,
  Users,
  Utensils,
} from 'lucide-react';

interface LayerIconProps {
  name: string;
  className?: string;
}

export const AVAILABLE_LAYER_ICONS = [
  { id: 'landmark', labelFa: 'بنای تاریخی / میراث', labelEn: 'Landmark' },
  { id: 'users', labelFa: 'مردم و مشاغل', labelEn: 'People & Crafts' },
  { id: 'sparkles', labelFa: 'فرهنگ و آیین', labelEn: 'Culture & Rituals' },
  { id: 'trees', labelFa: 'طبیعت و باغستان', labelEn: 'Nature & Gardens' },
  { id: 'book-open', labelFa: 'خاطرات و اسناد', labelEn: 'Memories & Docs' },
  { id: 'route', labelFa: 'مسیر داستانی', labelEn: 'Story Route' },
  { id: 'droplets', labelFa: 'قنات و چشمه', labelEn: 'Water & Qanat' },
  { id: 'flower', labelFa: 'گلستان و گلاب', labelEn: 'Rose & Distillation' },
  { id: 'mountain', labelFa: 'کوهستان و منظر', labelEn: 'Mountain View' },
  { id: 'home', labelFa: 'خانه تاریخی', labelEn: 'Historic House' },
  { id: 'camera', labelFa: 'عکس قدیمی', labelEn: 'Archival Photo' },
  { id: 'music', labelFa: 'آوا و موسیقی', labelEn: 'Audio & Oral' },
  { id: 'compass', labelFa: 'نقطه دیدنی', labelEn: 'Point of Interest' },
];

export function LayerIcon({ name, className = 'w-4 h-4' }: LayerIconProps) {
  switch (name) {
    case 'landmark':
      return <Landmark className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'trees':
      return <Trees className={className} />;
    case 'book-open':
      return <BookOpen className={className} />;
    case 'route':
      return <Route className={className} />;
    case 'droplets':
      return <Droplets className={className} />;
    case 'flower':
      return <Flower2 className={className} />;
    case 'mountain':
      return <Mountain className={className} />;
    case 'home':
      return <Home className={className} />;
    case 'building':
      return <Building2 className={className} />;
    case 'camera':
      return <Camera className={className} />;
    case 'music':
      return <Music className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'feather':
      return <Feather className={className} />;
    case 'utensils':
      return <Utensils className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'layers':
      return <Layers className={className} />;
    default:
      return <MapPin className={className} />;
  }
}
