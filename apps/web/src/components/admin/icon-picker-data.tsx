/**
 * Icon picker dataset — a curated Phosphor set + a curated emoji set, both
 * keyword-searchable. Curated (not the full 1,500-icon library) so the picker
 * stays fast and the bundle small while covering the property-management domain.
 *
 * Shared by IconPicker (the popover) and any surface that renders a stored icon
 * value (form tiles, template cards) via `renderIconValue` / `ICON_BY_NAME`.
 */

import {
  FileText, File, FilePdf, FileDoc, Files, Folder, Note, NotePencil, Receipt,
  ClipboardText, Signature, IdentificationCard, SealCheck, ShieldCheck, Stamp,
  House, HouseLine, Buildings, Storefront, Key, Door, Bed, Bathtub, Couch,
  Television, Bridge, Garage,
  CreditCard, Bank, Money, Coins, Wallet, ChartLine, ChartBar, Calculator, Tag,
  Users, User, UserCircle, HandWaving, Handshake, Smiley,
  Envelope, Phone, ChatCircle, ChatsCircle, Megaphone, Bell,
  WifiHigh, Lightbulb, Thermometer, Snowflake, Fire, Drop, Plugs, Wrench, Hammer,
  Toolbox, Broom, PaintRoller, Lightning,
  Calendar, Clock, MapPin, Compass, Car, Airplane, Suitcase, Sun, Moon, Tree,
  Leaf, Plant, Mountains,
  ForkKnife, Coffee, Wine, ShoppingCart, Gift, Star, Heart, Trophy, Target, Flag,
  Bookmark, Books, GraduationCap, Briefcase, Camera, Image, Lock, LockKey, Eye,
  Gear, Sliders, Sparkle, Confetti, CheckCircle, Warning, Info, PawPrint, Dog,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

export type IconValue =
  | { kind: "emoji"; value: string }
  | { kind: "icon"; value: string };

export type PhosphorEntry = { name: string; Icon: PhosphorIcon; keywords: string };

/** Curated, domain-relevant Phosphor icons. `name` is the stable stored value. */
export const PHOSPHOR_ICONS: PhosphorEntry[] = [
  // Documents
  { name: "FileText", Icon: FileText, keywords: "document file page text agreement" },
  { name: "File", Icon: File, keywords: "document file blank" },
  { name: "FilePdf", Icon: FilePdf, keywords: "pdf document file" },
  { name: "FileDoc", Icon: FileDoc, keywords: "doc word document file" },
  { name: "Files", Icon: Files, keywords: "documents files stack" },
  { name: "Folder", Icon: Folder, keywords: "folder directory group" },
  { name: "Note", Icon: Note, keywords: "note memo card" },
  { name: "NotePencil", Icon: NotePencil, keywords: "note edit write form" },
  { name: "ClipboardText", Icon: ClipboardText, keywords: "clipboard form checklist intake" },
  { name: "Receipt", Icon: Receipt, keywords: "receipt invoice bill" },
  { name: "Signature", Icon: Signature, keywords: "signature sign esign" },
  { name: "IdentificationCard", Icon: IdentificationCard, keywords: "id identity license w9 card" },
  { name: "SealCheck", Icon: SealCheck, keywords: "verified seal approved certified" },
  { name: "ShieldCheck", Icon: ShieldCheck, keywords: "shield insurance protection secure compliance" },
  { name: "Stamp", Icon: Stamp, keywords: "stamp approve permit official" },
  // Property
  { name: "House", Icon: House, keywords: "house home property rental" },
  { name: "HouseLine", Icon: HouseLine, keywords: "house home property" },
  { name: "Buildings", Icon: Buildings, keywords: "buildings property portfolio city" },
  { name: "Storefront", Icon: Storefront, keywords: "storefront shop business" },
  { name: "Key", Icon: Key, keywords: "key access lock checkin" },
  { name: "Door", Icon: Door, keywords: "door entry access" },
  { name: "Bed", Icon: Bed, keywords: "bed bedroom sleep" },
  { name: "Bathtub", Icon: Bathtub, keywords: "bath bathroom tub" },
  { name: "Couch", Icon: Couch, keywords: "couch sofa living furniture" },
  { name: "Television", Icon: Television, keywords: "tv television media" },
  { name: "Garage", Icon: Garage, keywords: "garage parking" },
  { name: "Bridge", Icon: Bridge, keywords: "bridge location" },
  // Money
  { name: "CreditCard", Icon: CreditCard, keywords: "card payment credit authorization" },
  { name: "Bank", Icon: Bank, keywords: "bank ach account payout" },
  { name: "Money", Icon: Money, keywords: "money cash payment" },
  { name: "Coins", Icon: Coins, keywords: "coins money fee" },
  { name: "Wallet", Icon: Wallet, keywords: "wallet payment balance" },
  { name: "ChartLine", Icon: ChartLine, keywords: "chart growth performance revenue" },
  { name: "ChartBar", Icon: ChartBar, keywords: "chart stats report" },
  { name: "Calculator", Icon: Calculator, keywords: "calculator finance math" },
  { name: "Tag", Icon: Tag, keywords: "tag price label" },
  // People + comms
  { name: "Users", Icon: Users, keywords: "people team owners guests" },
  { name: "User", Icon: User, keywords: "person owner guest user" },
  { name: "UserCircle", Icon: UserCircle, keywords: "profile person avatar" },
  { name: "HandWaving", Icon: HandWaving, keywords: "welcome hello greeting onboarding" },
  { name: "Handshake", Icon: Handshake, keywords: "deal agreement partner" },
  { name: "Smiley", Icon: Smiley, keywords: "happy face smile" },
  { name: "Envelope", Icon: Envelope, keywords: "email mail message" },
  { name: "Phone", Icon: Phone, keywords: "phone call contact" },
  { name: "ChatCircle", Icon: ChatCircle, keywords: "chat message comment" },
  { name: "ChatsCircle", Icon: ChatsCircle, keywords: "chats messages conversation" },
  { name: "Megaphone", Icon: Megaphone, keywords: "announce broadcast notice" },
  { name: "Bell", Icon: Bell, keywords: "bell notification reminder alert" },
  // Home systems / ops
  { name: "WifiHigh", Icon: WifiHigh, keywords: "wifi internet network" },
  { name: "Lightbulb", Icon: Lightbulb, keywords: "light idea electric" },
  { name: "Thermometer", Icon: Thermometer, keywords: "temperature thermostat hvac" },
  { name: "Snowflake", Icon: Snowflake, keywords: "cold ac cooling winter" },
  { name: "Fire", Icon: Fire, keywords: "heat fire furnace" },
  { name: "Drop", Icon: Drop, keywords: "water plumbing leak" },
  { name: "Plugs", Icon: Plugs, keywords: "power outlet electric" },
  { name: "Wrench", Icon: Wrench, keywords: "repair maintenance fix tool" },
  { name: "Hammer", Icon: Hammer, keywords: "build repair construction" },
  { name: "Toolbox", Icon: Toolbox, keywords: "tools maintenance setup" },
  { name: "Broom", Icon: Broom, keywords: "clean cleaning turnover" },
  { name: "PaintRoller", Icon: PaintRoller, keywords: "paint decor renovate" },
  { name: "Lightning", Icon: Lightning, keywords: "power energy fast action" },
  // Time / place / travel
  { name: "Calendar", Icon: Calendar, keywords: "calendar date schedule booking" },
  { name: "Clock", Icon: Clock, keywords: "time clock hours" },
  { name: "MapPin", Icon: MapPin, keywords: "location address pin map" },
  { name: "Compass", Icon: Compass, keywords: "guide explore directions guidebook" },
  { name: "Car", Icon: Car, keywords: "car parking transport" },
  { name: "Airplane", Icon: Airplane, keywords: "travel flight trip" },
  { name: "Suitcase", Icon: Suitcase, keywords: "luggage travel trip" },
  { name: "Sun", Icon: Sun, keywords: "sun day weather" },
  { name: "Moon", Icon: Moon, keywords: "night moon" },
  { name: "Tree", Icon: Tree, keywords: "tree nature outdoor" },
  { name: "Leaf", Icon: Leaf, keywords: "leaf nature eco green" },
  { name: "Plant", Icon: Plant, keywords: "plant garden nature" },
  { name: "Mountains", Icon: Mountains, keywords: "mountains nature view" },
  // Food / lifestyle
  { name: "ForkKnife", Icon: ForkKnife, keywords: "food dining kitchen restaurant" },
  { name: "Coffee", Icon: Coffee, keywords: "coffee cafe breakfast" },
  { name: "Wine", Icon: Wine, keywords: "wine drink welcome" },
  { name: "ShoppingCart", Icon: ShoppingCart, keywords: "shopping supplies groceries" },
  { name: "Gift", Icon: Gift, keywords: "gift welcome present" },
  // Misc / status
  { name: "Star", Icon: Star, keywords: "star favorite rating review" },
  { name: "Heart", Icon: Heart, keywords: "heart love favorite" },
  { name: "Trophy", Icon: Trophy, keywords: "trophy award win" },
  { name: "Target", Icon: Target, keywords: "target goal focus" },
  { name: "Flag", Icon: Flag, keywords: "flag milestone mark" },
  { name: "Bookmark", Icon: Bookmark, keywords: "bookmark save" },
  { name: "Books", Icon: Books, keywords: "books guide manual handbook" },
  { name: "GraduationCap", Icon: GraduationCap, keywords: "education training onboarding" },
  { name: "Briefcase", Icon: Briefcase, keywords: "work business portfolio" },
  { name: "Camera", Icon: Camera, keywords: "camera photo inspection" },
  { name: "Image", Icon: Image, keywords: "image photo picture" },
  { name: "Lock", Icon: Lock, keywords: "lock secure private" },
  { name: "LockKey", Icon: LockKey, keywords: "lock key secure access code" },
  { name: "Eye", Icon: Eye, keywords: "view seen preview" },
  { name: "Gear", Icon: Gear, keywords: "settings config gear" },
  { name: "Sliders", Icon: Sliders, keywords: "settings controls adjust" },
  { name: "Sparkle", Icon: Sparkle, keywords: "ai magic sparkle generate" },
  { name: "Confetti", Icon: Confetti, keywords: "celebrate done complete" },
  { name: "CheckCircle", Icon: CheckCircle, keywords: "done complete approved check" },
  { name: "Warning", Icon: Warning, keywords: "warning alert caution" },
  { name: "Info", Icon: Info, keywords: "info about details" },
  { name: "PawPrint", Icon: PawPrint, keywords: "pet pets policy animal" },
  { name: "Dog", Icon: Dog, keywords: "dog pet animal" },
];

export const ICON_BY_NAME: Record<string, PhosphorIcon> = Object.fromEntries(
  PHOSPHOR_ICONS.map((e) => [e.name, e.Icon]),
);

export type EmojiEntry = { char: string; keywords: string };
export type EmojiGroup = { label: string; emojis: EmojiEntry[] };

/** Curated emoji set grouped by category — covers the property/ops domain. */
export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    label: "Property",
    emojis: [
      { char: "🏠", keywords: "house home property" },
      { char: "🏡", keywords: "house garden home" },
      { char: "🏘️", keywords: "houses neighborhood" },
      { char: "🏚️", keywords: "house old" },
      { char: "🏢", keywords: "building office" },
      { char: "🏨", keywords: "hotel rental" },
      { char: "🏖️", keywords: "beach vacation" },
      { char: "🛏️", keywords: "bed bedroom" },
      { char: "🛋️", keywords: "couch living" },
      { char: "🚪", keywords: "door entry" },
      { char: "🔑", keywords: "key access" },
      { char: "🗝️", keywords: "key old access" },
      { char: "🧹", keywords: "broom clean turnover" },
      { char: "🧽", keywords: "sponge clean" },
      { char: "🪑", keywords: "chair furniture" },
      { char: "🚿", keywords: "shower bathroom" },
    ],
  },
  {
    label: "Documents",
    emojis: [
      { char: "📄", keywords: "document page file" },
      { char: "📃", keywords: "document curl page" },
      { char: "📝", keywords: "memo form write" },
      { char: "📋", keywords: "clipboard checklist" },
      { char: "📑", keywords: "tabs bookmark documents" },
      { char: "🗂️", keywords: "folder dividers files" },
      { char: "📁", keywords: "folder" },
      { char: "📂", keywords: "folder open" },
      { char: "✍️", keywords: "writing sign signature" },
      { char: "🖊️", keywords: "pen sign" },
      { char: "✅", keywords: "check done complete" },
      { char: "☑️", keywords: "checkbox done" },
      { char: "🔖", keywords: "bookmark label" },
      { char: "📌", keywords: "pin pinned" },
      { char: "📎", keywords: "paperclip attach" },
      { char: "🧾", keywords: "receipt invoice" },
    ],
  },
  {
    label: "Money",
    emojis: [
      { char: "💳", keywords: "card payment credit" },
      { char: "🏦", keywords: "bank ach" },
      { char: "💰", keywords: "money bag cash" },
      { char: "💵", keywords: "dollar cash money" },
      { char: "🪙", keywords: "coin money" },
      { char: "📊", keywords: "chart stats report" },
      { char: "📈", keywords: "growth chart up" },
      { char: "🧮", keywords: "calculator finance" },
      { char: "🏷️", keywords: "tag price" },
      { char: "🤝", keywords: "deal handshake agreement" },
    ],
  },
  {
    label: "Systems",
    emojis: [
      { char: "📶", keywords: "wifi signal network" },
      { char: "💡", keywords: "light bulb idea electric" },
      { char: "🌡️", keywords: "temperature thermostat" },
      { char: "❄️", keywords: "cold ac snow" },
      { char: "🔥", keywords: "heat fire furnace" },
      { char: "💧", keywords: "water drop plumbing" },
      { char: "🔌", keywords: "plug power electric" },
      { char: "🔧", keywords: "wrench repair tool" },
      { char: "🔨", keywords: "hammer build" },
      { char: "🧰", keywords: "toolbox tools" },
      { char: "🚰", keywords: "water tap" },
      { char: "🗑️", keywords: "trash waste bin" },
    ],
  },
  {
    label: "Travel & place",
    emojis: [
      { char: "📍", keywords: "location pin map" },
      { char: "🗺️", keywords: "map guide" },
      { char: "🧭", keywords: "compass guidebook directions" },
      { char: "📅", keywords: "calendar date schedule" },
      { char: "⏰", keywords: "clock time alarm" },
      { char: "🚗", keywords: "car parking" },
      { char: "✈️", keywords: "plane travel flight" },
      { char: "🧳", keywords: "luggage travel" },
      { char: "🌅", keywords: "sunrise morning" },
      { char: "🌴", keywords: "palm tropical vacation" },
    ],
  },
  {
    label: "People & welcome",
    emojis: [
      { char: "👋", keywords: "wave hello welcome" },
      { char: "🙌", keywords: "celebrate hands" },
      { char: "🎉", keywords: "party celebrate done" },
      { char: "🎁", keywords: "gift present welcome" },
      { char: "⭐", keywords: "star favorite rating" },
      { char: "❤️", keywords: "heart love" },
      { char: "👥", keywords: "people team owners" },
      { char: "🧑‍💼", keywords: "person business owner" },
      { char: "☕", keywords: "coffee breakfast" },
      { char: "🍷", keywords: "wine welcome drink" },
      { char: "🐾", keywords: "pet paw policy" },
      { char: "🔒", keywords: "lock secure private" },
    ],
  },
];

export const ALL_EMOJIS: EmojiEntry[] = EMOJI_GROUPS.flatMap((g) => g.emojis);
