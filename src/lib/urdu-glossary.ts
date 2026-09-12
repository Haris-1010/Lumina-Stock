import type { AppLanguage } from "@/lib/i18n";

const URDU_GLOSSARY: Record<string, string> = {
  electronics: "الیکٹرانکس",
  accessories: "لوازمات",
  office: "دفتر",
  supplies: "سامان",
  furniture: "فرنیچر",
  apparel: "ملبوسات",

  wireless: "وائرلیس",
  mechanical: "مکینیکل",
  mouse: "ماؤس",
  keyboard: "کی بورڈ",
  webcam: "ویب کیم",
  bluetooth: "بلو ٹوتھ",
  speaker: "اسپیکر",
  laptop: "لیپ ٹاپ",
  monitor: "مانیٹر",
  stand: "اسٹینڈ",
  light: "لائٹ",
  bar: "بار",
  charger: "چارجر",
  power: "پاور",
  bank: "بینک",
  noise: "شور",
  canceling: "کم کرنے والے",
  headphones: "ہیڈ فون",
  cable: "کیبل",
  screen: "اسکرین",
  protector: "محافظ",
  phone: "فون",
  case: "کیس",
  sleeve: "کَوَر",
  cover: "ڈھکن",
  organizer: "آرگنائزر",
  earbuds: "ایئربڈز",
  stylus: "اسٹائلس",
  pen: "پین",
  desk: "ڈیسک",
  pad: "پیڈ",
  leather: "چمڑا",
  sticky: "چپکنے والے",
  notes: "نوٹس",
  whiteboard: "وائٹ بورڈ",
  markers: "مارکرز",
  filing: "فائلنگ",
  cabinet: "کیبنٹ",
  paper: "کاغذ",
  shredder: "شریڈر",
  label: "لیبل",
  maker: "بنانے والا",
  stapler: "اسٹیپلر",
  heavy: "بھاری",
  duty: "ڈیوٹی",
  binder: "بائنڈر",
  clips: "کلپس",
  set: "سیٹ",
  ream: "ریم",
  standing: "کھڑے ہونے والا",
  ergonomic: "آرام دہ",
  chair: "کرسی",
  arm: "بازو",
  bookshelf: "کتابوں کی الماری",
  tier: "درجہ",
  drawer: "دراز",
  led: "ایل ای ڈی",
  footrest: "فٹ ریسٹ",
  adjustable: "قابلِ ایڈجسٹ",
  management: "انتظام",
  tray: "ٹرے",
  privacy: "رازداری",
  shelf: "شیلف",
  riser: "اونچا کرنے والا",
  company: "کمپنی",
  polo: "پولو",
  shirt: "قمیض",
  branded: "برانڈڈ",
  hoodie: "ہوڈی",
  safety: "حفاظتی",
  vest: "ویسٹ",
  work: "کام",
  boots: "بوٹس",
  lab: "لیب",
  coat: "کوٹ",
  cap: "ٹوپی",
  apron: "ایپرن",
  gloves: "دستانے",
  name: "نام",
  badge: "بیج",
  lanyard: "لے نیارڈ",
  stock: "اسٹاک",
  code: "کوڈ",
  starter: "اسٹارٹر",
  pack: "پیک",
  flash: "فوری",
  sale: "سیل",
  free: "مفت",
  add: "شامل",
  on: "پر",
  category: "کیٹیگری",

  usb: "یو ایس بی",
  "usb-c": "یو ایس بی-سی",
  hd: "ایچ ڈی",
  xl: "ایکس ایل",
  a4: "اے فور",
  "hi-vis": "ہائی وِز",
  sku: "اسٹاک کوڈ",
  units: "یونٹس",
  day: "دن",
};

const SPLIT_PATTERN = /(\s+|[-/(),.:;+])/g;

function isSeparator(part: string): boolean {
  return /^(\s+|[-/(),.:;+])$/.test(part);
}

function translateToken(token: string): string {
  const normalized = token.toLowerCase();
  const directMatch = URDU_GLOSSARY[normalized];
  if (directMatch) return directMatch;

  const stripped = normalized.replace(/[^a-z0-9+-]/g, "");
  const strippedMatch = URDU_GLOSSARY[stripped];
  if (strippedMatch) return strippedMatch;

  return token;
}

export function toUrduMeaning(text: string): string {
  if (!text.trim()) return text;

  return text
    .split(SPLIT_PATTERN)
    .map((part) => (isSeparator(part) ? part : translateToken(part)))
    .join("");
}

export function withUrduMeaning(text: string, language: AppLanguage): string {
  if (language !== "ur") return text;

  const meaning = toUrduMeaning(text);
  if (meaning.toLowerCase() === text.toLowerCase()) return text;

  return `${text} (${meaning})`;
}
