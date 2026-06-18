"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  Airplane,
  AirplaneTilt,
  Bank,
  Bathtub,
  Bed,
  Bell,
  BookOpen,
  Broadcast,
  Broom,
  Buildings,
  Bus,
  CalendarBlank,
  Camera,
  Car,
  CellSignalFull,
  ChartBar,
  ChartLineUp,
  CheckCircle,
  ChatCircle,
  ClipboardText,
  CloudArrowUp,
  Coins,
  Compass,
  Coffee,
  Confetti,
  CookingPot,
  CreditCard,
  CurrencyCircleDollar,
  CurrencyDollar,
  Database,
  DeviceMobile,
  DoorOpen,
  Drop,
  Elevator,
  Envelope,
  FilePdf,
  FilePlus,
  FileText,
  Fire,
  FireExtinguisher,
  FirstAid,
  FolderOpen,
  FolderSimple,
  ForkKnife,
  Garage,
  GearSix,
  Globe,
  Handshake,
  Hammer,
  Heartbeat,
  HouseLine,
  HouseSimple,
  House,
  IdentificationCard,
  ImageSquare,
  Invoice,
  Key,
  Keyhole,
  Ladder,
  Lightning,
  Lightbulb,
  LinkSimple,
  ListChecks,
  ListMagnifyingGlass,
  LockKey,
  LockSimple,
  MapPinArea,
  MapPinLine,
  MapPin,
  MapTrifold,
  Medal,
  Megaphone,
  Mountains,
  Notebook,
  Package,
  Password,
  PawPrint,
  PaintBrush,
  PaperPlaneTilt,
  PenNib,
  PhoneCall,
  Plant,
  Pulse,
  QrCode,
  Question,
  Receipt,
  ReceiptX,
  RocketLaunch,
  Rows,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  Signature,
  Siren,
  SlidersHorizontal,
  Snowflake,
  Sparkle,
  Star,
  Stairs,
  Storefront,
  Sun,
  SwimmingPool,
  Taxi,
  TextAa,
  ThermometerHot,
  Timer,
  Toolbox,
  Tree,
  Trash,
  UploadSimple,
  UserCircle,
  UserGear,
  Users,
  UsersThree,
  Wallet,
  Warning,
  WifiSlash,
  WifiHigh,
  Wine,
  Wrench,
} from "@phosphor-icons/react";

export type FormSymbolValue = `icon:${string}` | `emoji:${string}`;
export type FormSymbolKind = "icon" | "emoji";

export type FormSymbolCategory =
  | "Suggested"
  | "Property"
  | "Access"
  | "Utilities"
  | "Documents"
  | "Compliance"
  | "Money"
  | "Maintenance"
  | "Hospitality"
  | "People"
  | "Surveys"
  | "General";

export type FormIconKey =
  | "form"
  | "house"
  | "houseLine"
  | "houseSimple"
  | "buildings"
  | "storefront"
  | "door"
  | "garage"
  | "map"
  | "mapArea"
  | "pin"
  | "pinLine"
  | "compass"
  | "bed"
  | "bath"
  | "pool"
  | "mountains"
  | "tree"
  | "plant"
  | "sun"
  | "snow"
  | "fire"
  | "elevator"
  | "stairs"
  | "wifi"
  | "offline"
  | "broadcast"
  | "signal"
  | "mobile"
  | "database"
  | "cloud"
  | "power"
  | "water"
  | "temperature"
  | "key"
  | "keyhole"
  | "lock"
  | "lockSimple"
  | "password"
  | "qr"
  | "file"
  | "filePlus"
  | "folder"
  | "folderOpen"
  | "pdf"
  | "clipboard"
  | "checklist"
  | "review"
  | "guide"
  | "upload"
  | "images"
  | "notebook"
  | "text"
  | "signature"
  | "pen"
  | "calendar"
  | "card"
  | "receipt"
  | "invoice"
  | "refund"
  | "money"
  | "deposit"
  | "coins"
  | "wallet"
  | "bank"
  | "shield"
  | "verified"
  | "approved"
  | "id"
  | "warning"
  | "siren"
  | "heartbeat"
  | "firstAid"
  | "fireSafety"
  | "wrench"
  | "toolbox"
  | "hammer"
  | "paint"
  | "ladder"
  | "trash"
  | "timer"
  | "gear"
  | "sliders"
  | "broom"
  | "camera"
  | "package"
  | "coffee"
  | "dining"
  | "wine"
  | "arrival"
  | "taxi"
  | "bus"
  | "utensils"
  | "confetti"
  | "sparkle"
  | "medal"
  | "star"
  | "plane"
  | "car"
  | "paw"
  | "users"
  | "owners"
  | "user"
  | "manager"
  | "handshake"
  | "chat"
  | "phone"
  | "mail"
  | "bell"
  | "globe"
  | "link"
  | "share"
  | "send"
  | "rocket"
  | "chart"
  | "growth"
  | "pulse"
  | "megaphone"
  | "help"
  | "bulb";

export type FormTintKey =
  | "blue"
  | "teal"
  | "violet"
  | "amber"
  | "rose"
  | "pine"
  | "indigo"
  | "slate";

export type FormIconSymbol = {
  value: `icon:${FormIconKey}`;
  key: FormIconKey;
  kind: "icon";
  label: string;
  category: FormSymbolCategory;
  keywords: string[];
  aliases: string[];
  Icon: Icon;
};

export type FormEmojiSymbol = {
  value: `emoji:${string}`;
  kind: "emoji";
  label: string;
  category: FormSymbolCategory;
  keywords: string[];
  aliases: string[];
  codepoints: string;
};

export type FormSymbol = FormIconSymbol | FormEmojiSymbol;

export type FormTint = {
  key: FormTintKey | "custom";
  label: string;
  bg: string;
  fg: string;
};

function iconSymbol(
  key: FormIconKey,
  label: string,
  category: FormSymbolCategory,
  Icon: Icon,
  keywords: string[],
  aliases: string[] = [],
): FormIconSymbol {
  return {
    value: `icon:${key}`,
    key,
    kind: "icon",
    label,
    category,
    keywords,
    aliases,
    Icon,
  };
}

function emojiSymbol(
  codepoints: string,
  label: string,
  category: FormSymbolCategory,
  keywords: string[],
  aliases: string[] = [],
): FormEmojiSymbol {
  return {
    value: `emoji:${codepoints}`,
    kind: "emoji",
    label,
    category,
    keywords,
    aliases,
    codepoints,
  };
}

export const FORM_ICON_SYMBOLS: FormIconSymbol[] = [
  iconSymbol("form", "Form", "General", Rows, ["form", "fields", "intake", "questionnaire"]),
  iconSymbol("house", "Property", "Property", House, ["property", "home", "house", "listing"]),
  iconSymbol("houseLine", "Home", "Property", HouseLine, ["home", "residence", "property"]),
  iconSymbol("houseSimple", "Stay", "Property", HouseSimple, ["stay", "home", "rental"]),
  iconSymbol("buildings", "Buildings", "Property", Buildings, ["building", "portfolio", "units"]),
  iconSymbol("storefront", "Storefront", "Property", Storefront, ["storefront", "retail", "commercial"]),
  iconSymbol("door", "Entry", "Property", DoorOpen, ["entry", "door", "arrival"]),
  iconSymbol("garage", "Garage", "Property", Garage, ["garage", "parking", "vehicle"]),
  iconSymbol("map", "Map", "Property", MapTrifold, ["map", "area", "directions"]),
  iconSymbol("mapArea", "Area", "Property", MapPinArea, ["area", "region", "neighborhood"]),
  iconSymbol("pin", "Location", "Property", MapPin, ["location", "address", "place"]),
  iconSymbol("pinLine", "Checkpoint", "Property", MapPinLine, ["checkpoint", "address", "location"]),
  iconSymbol("compass", "Neighborhood", "Property", Compass, ["neighborhood", "orientation", "area"]),
  iconSymbol("bed", "Bedrooms", "Property", Bed, ["bed", "sleep", "bedrooms"]),
  iconSymbol("bath", "Bathrooms", "Property", Bathtub, ["bath", "bathroom", "tub"]),
  iconSymbol("pool", "Pool", "Property", SwimmingPool, ["pool", "amenity", "swim"]),
  iconSymbol("mountains", "View", "Property", Mountains, ["view", "mountains", "scenery"]),
  iconSymbol("tree", "Outdoor", "Property", Tree, ["yard", "outdoor", "tree"]),
  iconSymbol("plant", "Landscaping", "Property", Plant, ["landscaping", "garden", "plants"]),
  iconSymbol("sun", "Weather", "Property", Sun, ["sun", "patio", "outdoor"]),
  iconSymbol("snow", "Climate", "Property", Snowflake, ["snow", "air conditioning", "climate"]),
  iconSymbol("fire", "Fireplace", "Property", Fire, ["fire", "fireplace", "fire pit"]),
  iconSymbol("elevator", "Elevator", "Property", Elevator, ["elevator", "lift", "access"]),
  iconSymbol("stairs", "Stairs", "Property", Stairs, ["stairs", "steps", "floor"]),
  iconSymbol("wifi", "Wi-Fi", "Utilities", WifiHigh, ["wifi", "wi-fi", "wireless", "network", "ssid", "internet"]),
  iconSymbol("offline", "Offline", "Utilities", WifiSlash, ["offline", "disconnected", "outage"]),
  iconSymbol("broadcast", "Broadcast", "Utilities", Broadcast, ["broadcast", "signal", "network"]),
  iconSymbol("signal", "Signal", "Utilities", CellSignalFull, ["signal", "cell", "wireless", "network"]),
  iconSymbol("mobile", "Mobile", "Utilities", DeviceMobile, ["mobile", "phone", "device"]),
  iconSymbol("database", "Data", "Utilities", Database, ["data", "database", "records"]),
  iconSymbol("cloud", "Upload", "Utilities", CloudArrowUp, ["cloud", "sync", "upload"]),
  iconSymbol("power", "Power", "Utilities", Lightning, ["power", "electric", "outlet"]),
  iconSymbol("water", "Water", "Utilities", Drop, ["water", "plumbing", "utility"]),
  iconSymbol("temperature", "Temperature", "Utilities", ThermometerHot, ["temperature", "heat", "thermostat"]),
  iconSymbol("key", "Access", "Access", Key, ["key", "access", "password", "lock", "entry"]),
  iconSymbol("keyhole", "Key code", "Access", Keyhole, ["key code", "code", "access"]),
  iconSymbol("lock", "Lock", "Access", LockKey, ["lock", "secure", "private", "access"]),
  iconSymbol("lockSimple", "Secure", "Access", LockSimple, ["secure", "private", "lock"]),
  iconSymbol("password", "Password", "Access", Password, ["password", "pin", "code", "credential"]),
  iconSymbol("qr", "QR code", "Access", QrCode, ["qr", "code", "scan", "access"]),
  iconSymbol("file", "Document", "Documents", FileText, ["document", "file", "paperwork"]),
  iconSymbol("filePlus", "New file", "Documents", FilePlus, ["new file", "add document", "paperwork"]),
  iconSymbol("folder", "Folder", "Documents", FolderSimple, ["folder", "documents", "files"]),
  iconSymbol("folderOpen", "Files", "Documents", FolderOpen, ["files", "folder", "documents"]),
  iconSymbol("pdf", "PDF", "Documents", FilePdf, ["pdf", "document", "file"]),
  iconSymbol("clipboard", "Checklist", "Documents", ClipboardText, ["clipboard", "checklist", "steps"]),
  iconSymbol("checklist", "Tasks", "Documents", ListChecks, ["tasks", "checklist", "todo"]),
  iconSymbol("review", "Review", "Documents", ListMagnifyingGlass, ["review", "audit", "check"]),
  iconSymbol("guide", "Guide", "Documents", BookOpen, ["guide", "manual", "instructions"]),
  iconSymbol("upload", "Upload", "Documents", UploadSimple, ["upload", "attachment", "file"]),
  iconSymbol("images", "Photos", "Documents", ImageSquare, ["image", "photo", "pictures"]),
  iconSymbol("notebook", "Notes", "Documents", Notebook, ["notes", "notebook", "instructions"]),
  iconSymbol("text", "Text", "Documents", TextAa, ["text", "copy", "writing"]),
  iconSymbol("signature", "Signature", "Documents", Signature, ["signature", "sign", "agreement"]),
  iconSymbol("pen", "Pen", "Documents", PenNib, ["pen", "write", "signature"]),
  iconSymbol("calendar", "Calendar", "Documents", CalendarBlank, ["calendar", "date", "schedule"]),
  iconSymbol("approved", "Approved", "Compliance", CheckCircle, ["approved", "complete", "verified"]),
  iconSymbol("card", "Payment Card", "Money", CreditCard, ["payment", "card", "credit card"]),
  iconSymbol("receipt", "Receipt", "Money", Receipt, ["receipt", "invoice", "expense"]),
  iconSymbol("invoice", "Invoice", "Money", Invoice, ["invoice", "bill", "payment"]),
  iconSymbol("refund", "Refund", "Money", ReceiptX, ["refund", "void", "payment"]),
  iconSymbol("money", "Money", "Money", CurrencyDollar, ["money", "payment", "fee", "revenue"]),
  iconSymbol("deposit", "Deposit", "Money", CurrencyCircleDollar, ["deposit", "money", "security deposit"]),
  iconSymbol("coins", "Payments", "Money", Coins, ["payments", "money", "fees"]),
  iconSymbol("wallet", "Wallet", "Money", Wallet, ["wallet", "payment", "deposit"]),
  iconSymbol("bank", "Bank", "Money", Bank, ["bank", "account", "payout"]),
  iconSymbol("shield", "Insurance", "Compliance", ShieldCheck, ["insurance", "compliance", "secure"]),
  iconSymbol("verified", "Verified", "Compliance", SealCheck, ["verified", "compliance", "approved"]),
  iconSymbol("id", "Identity", "Compliance", IdentificationCard, ["id", "identity", "license"]),
  iconSymbol("warning", "Warning", "Compliance", Warning, ["warning", "risk", "attention"]),
  iconSymbol("siren", "Urgent", "Compliance", Siren, ["urgent", "alert", "emergency"]),
  iconSymbol("heartbeat", "Health", "Compliance", Heartbeat, ["health", "status", "safety"]),
  iconSymbol("firstAid", "First aid", "Compliance", FirstAid, ["first aid", "safety", "health"]),
  iconSymbol("fireSafety", "Fire safety", "Compliance", FireExtinguisher, ["fire safety", "extinguisher", "emergency"]),
  iconSymbol("wrench", "Maintenance", "Maintenance", Wrench, ["maintenance", "repair", "fix"]),
  iconSymbol("toolbox", "Toolbox", "Maintenance", Toolbox, ["toolbox", "maintenance", "tools"]),
  iconSymbol("hammer", "Repair", "Maintenance", Hammer, ["repair", "fix", "maintenance"]),
  iconSymbol("paint", "Paint", "Maintenance", PaintBrush, ["paint", "touch up", "maintenance"]),
  iconSymbol("ladder", "Ladder", "Maintenance", Ladder, ["ladder", "maintenance", "access"]),
  iconSymbol("trash", "Trash", "Maintenance", Trash, ["trash", "waste", "cleanup"]),
  iconSymbol("timer", "Timer", "Maintenance", Timer, ["timer", "duration", "estimate"]),
  iconSymbol("gear", "Settings", "Maintenance", GearSix, ["settings", "configuration", "setup"]),
  iconSymbol("sliders", "Controls", "Maintenance", SlidersHorizontal, ["controls", "settings", "preferences"]),
  iconSymbol("broom", "Cleaning", "Maintenance", Broom, ["cleaning", "turnover", "housekeeping"]),
  iconSymbol("camera", "Photos", "Maintenance", Camera, ["camera", "photo", "inspection"]),
  iconSymbol("package", "Supplies", "Maintenance", Package, ["package", "supplies", "inventory"]),
  iconSymbol("coffee", "Coffee", "Hospitality", Coffee, ["coffee", "amenity", "welcome"]),
  iconSymbol("dining", "Dining", "Hospitality", ForkKnife, ["dining", "food", "restaurant"]),
  iconSymbol("wine", "Drinks", "Hospitality", Wine, ["drinks", "wine", "bar"]),
  iconSymbol("arrival", "Arrival", "Hospitality", AirplaneTilt, ["arrival", "travel", "guest"]),
  iconSymbol("taxi", "Transit", "Hospitality", Taxi, ["transit", "taxi", "transportation"]),
  iconSymbol("bus", "Shuttle", "Hospitality", Bus, ["shuttle", "bus", "transportation"]),
  iconSymbol("utensils", "Kitchen", "Hospitality", CookingPot, ["kitchen", "cooking", "food"]),
  iconSymbol("confetti", "Welcome", "Hospitality", Confetti, ["welcome", "celebration", "guest"]),
  iconSymbol("sparkle", "Polish", "Hospitality", Sparkle, ["sparkle", "clean", "premium"]),
  iconSymbol("medal", "Quality", "Hospitality", Medal, ["quality", "award", "rating"]),
  iconSymbol("star", "Review", "Hospitality", Star, ["review", "rating", "favorite"]),
  iconSymbol("plane", "Travel", "Hospitality", Airplane, ["travel", "trip", "guest"]),
  iconSymbol("car", "Parking", "Hospitality", Car, ["parking", "car", "vehicle"]),
  iconSymbol("paw", "Pets", "Hospitality", PawPrint, ["pet", "dog", "cat"]),
  iconSymbol("users", "People", "People", UsersThree, ["people", "owners", "team"]),
  iconSymbol("owners", "Owners", "People", Users, ["owners", "residents", "people"]),
  iconSymbol("user", "Owner", "People", UserCircle, ["owner", "person", "profile"]),
  iconSymbol("manager", "Manager", "People", UserGear, ["manager", "staff", "admin"]),
  iconSymbol("handshake", "Agreement", "People", Handshake, ["agreement", "relationship", "partner"]),
  iconSymbol("chat", "Survey", "Surveys", ChatCircle, ["survey", "feedback", "chat", "questions"]),
  iconSymbol("phone", "Phone", "Surveys", PhoneCall, ["phone", "call", "contact"]),
  iconSymbol("mail", "Email", "Surveys", Envelope, ["email", "message", "contact"]),
  iconSymbol("bell", "Reminder", "Surveys", Bell, ["reminder", "notification", "alert"]),
  iconSymbol("globe", "Public", "General", Globe, ["public", "web", "link"]),
  iconSymbol("link", "Link", "General", LinkSimple, ["link", "share", "url"]),
  iconSymbol("share", "Share", "General", ShareNetwork, ["share", "send", "link"]),
  iconSymbol("send", "Send", "General", PaperPlaneTilt, ["send", "submit", "share"]),
  iconSymbol("rocket", "Launch", "General", RocketLaunch, ["launch", "publish", "start"]),
  iconSymbol("chart", "Analytics", "General", ChartBar, ["analytics", "chart", "metrics"]),
  iconSymbol("growth", "Growth", "General", ChartLineUp, ["growth", "trend", "analytics"]),
  iconSymbol("pulse", "Pulse", "General", Pulse, ["pulse", "status", "activity"]),
  iconSymbol("megaphone", "Announcement", "General", Megaphone, ["announcement", "broadcast", "notice"]),
  iconSymbol("help", "Question", "General", Question, ["question", "help", "support"]),
  iconSymbol("bulb", "Tips", "General", Lightbulb, ["tips", "idea", "help"]),
];

export const FORM_EMOJI_SYMBOLS: FormEmojiSymbol[] = [
  emojiSymbol("1f4f6", "Signal", "Utilities", ["wifi", "signal", "network", "wireless"], ["bars"]),
  emojiSymbol("1f511", "Key", "Access", ["key", "access", "password", "lock"]),
  emojiSymbol("1f3e0", "House", "Property", ["home", "house", "property"]),
  emojiSymbol("1f3e1", "Home", "Property", ["home", "rental", "property"]),
  emojiSymbol("1f3d8-fe0f", "Neighborhood", "Property", ["neighborhood", "community", "area"]),
  emojiSymbol("1f3e2", "Building", "Property", ["building", "office", "units"]),
  emojiSymbol("1f3e8", "Hotel", "Property", ["hotel", "lodging", "stay"]),
  emojiSymbol("1f9ed", "Compass", "Property", ["compass", "directions", "area"]),
  emojiSymbol("1f4cd", "Pin", "Property", ["location", "address", "pin"]),
  emojiSymbol("1f6aa", "Door", "Property", ["door", "entry", "access"]),
  emojiSymbol("1f6cf-fe0f", "Bed", "Property", ["bed", "bedroom", "sleep"]),
  emojiSymbol("1f6c1", "Bath", "Property", ["bath", "bathroom", "tub"]),
  emojiSymbol("1f6d7", "Elevator", "Property", ["elevator", "lift", "building"]),
  emojiSymbol("1f697", "Parking", "Hospitality", ["car", "parking", "vehicle"]),
  emojiSymbol("1f436", "Pets", "Hospitality", ["pet", "dog", "pets"]),
  emojiSymbol("26a1", "Power", "Utilities", ["power", "electric", "utility"]),
  emojiSymbol("1f4a7", "Water", "Utilities", ["water", "plumbing", "utility"]),
  emojiSymbol("1f50c", "Plug", "Utilities", ["plug", "power", "outlet"]),
  emojiSymbol("1f321-fe0f", "Temperature", "Utilities", ["temperature", "heat", "climate"]),
  emojiSymbol("1f4dd", "Memo", "Documents", ["form", "memo", "notes", "document"]),
  emojiSymbol("1f4cb", "Clipboard", "Documents", ["clipboard", "checklist", "form"]),
  emojiSymbol("1f4c4", "Page", "Documents", ["page", "document", "paperwork"]),
  emojiSymbol("1f4c1", "Folder", "Documents", ["folder", "files", "documents"]),
  emojiSymbol("1f5c2-fe0f", "File box", "Documents", ["folder", "files", "archive"]),
  emojiSymbol("1f4ce", "Attachment", "Documents", ["attachment", "paperclip", "file"]),
  emojiSymbol("1f50d", "Search", "Documents", ["search", "review", "inspect"]),
  emojiSymbol("1f4c5", "Date", "Documents", ["date", "calendar", "schedule"]),
  emojiSymbol("270d-fe0f", "Signature", "Documents", ["signature", "write", "sign"]),
  emojiSymbol("23f1-fe0f", "Timer", "Documents", ["timer", "time", "duration"]),
  emojiSymbol("1f552", "Clock", "Documents", ["clock", "time", "schedule"]),
  emojiSymbol("1f4f7", "Camera", "Maintenance", ["camera", "photo", "inspection"]),
  emojiSymbol("1f527", "Wrench", "Maintenance", ["maintenance", "repair"]),
  emojiSymbol("1f6e0-fe0f", "Tools", "Maintenance", ["tools", "maintenance", "repair"]),
  emojiSymbol("1f528", "Hammer", "Maintenance", ["hammer", "repair", "maintenance"]),
  emojiSymbol("1f9f0", "Toolbox", "Maintenance", ["toolbox", "tools", "maintenance"]),
  emojiSymbol("1f9f9", "Cleaning", "Maintenance", ["cleaning", "turnover", "broom"]),
  emojiSymbol("1f9f4", "Supplies", "Maintenance", ["supplies", "amenities", "inventory"]),
  emojiSymbol("1f4e6", "Package", "Maintenance", ["package", "supplies", "inventory"]),
  emojiSymbol("1f6e1-fe0f", "Shield", "Compliance", ["insurance", "compliance", "security"]),
  emojiSymbol("1faaa", "ID", "Compliance", ["id", "identity", "license"]),
  emojiSymbol("2705", "Approved", "Compliance", ["approved", "complete", "verified"]),
  emojiSymbol("2611-fe0f", "Checked", "Compliance", ["checked", "complete", "approved"]),
  emojiSymbol("26a0-fe0f", "Warning", "Compliance", ["warning", "risk", "attention"]),
  emojiSymbol("1f6a8", "Emergency", "Compliance", ["emergency", "alert", "urgent"]),
  emojiSymbol("1f9ef", "Fire safety", "Compliance", ["fire safety", "extinguisher", "emergency"]),
  emojiSymbol("1f4b3", "Payment", "Money", ["payment", "card", "credit"]),
  emojiSymbol("1f9fe", "Receipt", "Money", ["receipt", "invoice", "expense"]),
  emojiSymbol("1f4b0", "Money", "Money", ["money", "fee", "deposit"]),
  emojiSymbol("1fa99", "Coin", "Money", ["coin", "payment", "money"]),
  emojiSymbol("1f4b5", "Cash", "Money", ["cash", "money", "payment"]),
  emojiSymbol("2615", "Coffee", "Hospitality", ["coffee", "welcome", "amenity"]),
  emojiSymbol("1f37d-fe0f", "Dining", "Hospitality", ["dining", "food", "meal"]),
  emojiSymbol("1f9f3", "Luggage", "Hospitality", ["luggage", "travel", "guest"]),
  emojiSymbol("1f6ce-fe0f", "Service", "Hospitality", ["service", "bell", "guest"]),
  emojiSymbol("1f389", "Welcome", "Hospitality", ["welcome", "celebration", "guest"]),
  emojiSymbol("2b50", "Star", "Hospitality", ["rating", "review", "star"]),
  emojiSymbol("1f44b", "Greeting", "Hospitality", ["welcome", "hello", "guest"]),
  emojiSymbol("1f465", "People", "People", ["people", "owners", "team"]),
  emojiSymbol("1f464", "Person", "People", ["person", "owner", "profile"]),
  emojiSymbol("1f91d", "Agreement", "People", ["agreement", "handshake", "partner"]),
  emojiSymbol("1f4ac", "Survey", "Surveys", ["survey", "feedback", "message"]),
  emojiSymbol("1f4de", "Phone", "Surveys", ["phone", "call", "contact"]),
  emojiSymbol("1f4e7", "Email", "Surveys", ["email", "message", "contact"]),
  emojiSymbol("1f514", "Reminder", "Surveys", ["reminder", "bell", "notification"]),
  emojiSymbol("1f680", "Launch", "General", ["launch", "publish", "start"]),
  emojiSymbol("1f4e3", "Announcement", "General", ["announcement", "broadcast", "notice"]),
  emojiSymbol("1f3af", "Goal", "General", ["goal", "target", "focus"]),
  emojiSymbol("1f517", "Link", "General", ["link", "share", "url"]),
  emojiSymbol("1f4a1", "Idea", "General", ["idea", "tips", "help"]),
  emojiSymbol("1f4ca", "Analytics", "General", ["analytics", "chart", "metrics"]),
];

export const FORM_SYMBOLS: FormSymbol[] = [
  ...FORM_ICON_SYMBOLS,
  ...FORM_EMOJI_SYMBOLS,
];

export const FORM_TINTS: FormTint[] = [
  { key: "blue", label: "Blue", bg: "rgba(27, 119, 190, 0.12)", fg: "#1b77be" },
  { key: "teal", label: "Teal", bg: "rgba(13, 148, 136, 0.12)", fg: "#0d9488" },
  { key: "violet", label: "Violet", bg: "rgba(124, 92, 217, 0.12)", fg: "#6d4ad1" },
  { key: "amber", label: "Amber", bg: "rgba(202, 138, 4, 0.14)", fg: "#b27908" },
  { key: "rose", label: "Rose", bg: "rgba(219, 75, 109, 0.12)", fg: "#d04268" },
  { key: "pine", label: "Pine", bg: "rgba(15, 118, 110, 0.12)", fg: "#0f766e" },
  { key: "indigo", label: "Indigo", bg: "rgba(67, 97, 209, 0.12)", fg: "#4361d1" },
  { key: "slate", label: "Slate", bg: "rgba(71, 85, 105, 0.12)", fg: "#475569" },
];

export const FORM_ICONS = FORM_ICON_SYMBOLS.map(({ key, label, Icon }) => ({
  key,
  label,
  Icon,
}));

const SYMBOL_BY_VALUE = new Map<FormSymbolValue, FormSymbol>(
  FORM_SYMBOLS.map((symbol) => [symbol.value, symbol]),
);
const ICON_BY_LEGACY_KEY = new Map<FormIconKey, FormIconSymbol>(
  FORM_ICON_SYMBOLS.map((symbol) => [symbol.key, symbol]),
);
const TINT_BY_KEY = new Map<FormTintKey, FormTint>(
  FORM_TINTS.map((tint) => [tint.key as FormTintKey, tint]),
);

export function emojiFromCodepoints(codepoints: string): string {
  return String.fromCodePoint(
    ...codepoints.split("-").map((part) => Number.parseInt(part, 16)),
  );
}

export function normalizeSymbolValue(value: string | null): FormSymbolValue | null {
  if (!value) return null;
  if (value.startsWith("icon:") || value.startsWith("emoji:")) {
    return value as FormSymbolValue;
  }
  if (ICON_BY_LEGACY_KEY.has(value as FormIconKey)) {
    return `icon:${value}`;
  }
  return null;
}

export function resolveSymbolValue(value: string | null): FormSymbol {
  const normalized = normalizeSymbolValue(value);
  if (normalized) {
    const symbol = SYMBOL_BY_VALUE.get(normalized);
    if (symbol) return symbol;
  }
  return ICON_BY_LEGACY_KEY.get("form") ?? FORM_ICON_SYMBOLS[0];
}

export function resolveTintValue(value: string | null, fallbackId: string): FormTint {
  if (value) {
    const hex = normalizeHexColor(value);
    if (hex) return tintFromHex(hex);

    const tint = TINT_BY_KEY.get(value as FormTintKey);
    if (tint) return tint;
  }
  return FORM_TINTS[hash(fallbackId) % FORM_TINTS.length];
}

export function normalizeHexColor(value: string | null): `#${string}` | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return null;
  return `#${match[1].toLowerCase()}`;
}

export function isHexColor(value: string | null): boolean {
  return normalizeHexColor(value) !== null;
}

function tintFromHex(hex: `#${string}`): FormTint {
  return {
    key: "custom",
    label: hex.toUpperCase(),
    bg: hexToRgba(hex, 0.13),
    fg: hex,
  };
}

function hexToRgba(hex: `#${string}`, alpha: number): string {
  const raw = hex.slice(1);
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getSymbolByValue(value: FormSymbolValue): FormSymbol | null {
  return SYMBOL_BY_VALUE.get(value) ?? null;
}

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
