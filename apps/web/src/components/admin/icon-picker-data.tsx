/**
 * Lean icon resolution map — the name to Phosphor-component lookup used to
 * RENDER a stored icon value (form tiles, list rows, cards via form-icon.tsx).
 *
 * The searchable catalog (keywords + emoji set) lives in icon-picker-catalog.tsx
 * and is imported ONLY by the IconPicker, so list/card code that just needs to
 * resolve a stored "ph:Name" never pulls the keyword strings + emoji into its
 * bundle. ICON_BY_NAME is a standalone literal (not derived from the catalog) to
 * keep that boundary clean.
 */

import {
  // Documents & files
  FileText, File, FilePdf, FileDoc, Files, Folder, Note, NotePencil, Receipt,
  ClipboardText, Signature, IdentificationCard, SealCheck, ShieldCheck, Stamp,
  FilePlus, FileMinus, FileLock, FileMagnifyingGlass, FileCsv, FileXls, FileZip,
  FileImage, FileArrowDown, FileArrowUp, Archive, Clipboard, Invoice, Paperclip,
  PaperclipHorizontal, Certificate, Gavel, Scales,
  // Writing & editing
  Pen, PenNib, Pencil, PencilSimple, PencilLine, Eraser, Highlighter,
  // Property & real estate
  House, HouseLine, HouseSimple, Buildings, BuildingApartment, BuildingOffice,
  Storefront, Key, Door, Bed, Bathtub, Couch, Television, Bridge, Garage,
  Armchair, Chair, Shower, Toilet, Oven, Lamp, Towel, Rug, Table, Desk,
  Dresser, SwimmingPool, Ruler, Screwdriver,
  // Finance & payment
  CreditCard, Bank, Money, Coins, Wallet, ChartLine, ChartBar, Calculator, Tag,
  CurrencyDollar, Cardholder, Percent, ChartPie, ChartBarHorizontal, ChartDonut,
  Graph,
  // People & contacts
  Users, User, UserCircle, HandWaving, Handshake, Smiley, UsersFour, UsersThree,
  Person, AddressBook, AddressBookTabs,
  // Communication
  Envelope, Phone, ChatCircle, ChatsCircle, Megaphone, Bell,
  EnvelopeOpen, Mailbox, PhoneCall, BellRinging, BellSlash, BellZ,
  ChatText, ChatDots,
  // Home systems & amenities
  WifiHigh, Lightbulb, Thermometer, Snowflake, Fire, Drop, Plugs, Wrench, Hammer,
  Toolbox, Broom, PaintRoller, Lightning,
  FireSimple, FireExtinguisher, Pipe, PipeWrench,
  // Time & calendar
  Calendar, Clock, CalendarBlank, CalendarCheck, CalendarPlus, Alarm, Hourglass,
  // Travel & location
  MapPin, Compass, Car, Airplane, Suitcase, Sun, Moon, Tree,
  Leaf, Plant, Mountains, MapTrifold, Globe, City, RoadHorizon,
  Taxi, Bus, Train, Bicycle, Boat, Truck, Van, Motorcycle, Park, Anchor,
  MoonStars, SunHorizon, TreePalm, Footprints,
  // Nature & weather
  CloudSun, CloudRain, Rainbow, Campfire, Flower, FlowerLotus,
  // Food & lifestyle
  ForkKnife, Coffee, Wine, ShoppingCart, Gift, Bread, Pizza, Cookie,
  Avocado, Carrot, Fish, Orange, Cake, Pepper,
  // Status & UI actions
  Star, Heart, Trophy, Target, Flag, FlagBanner,
  Bookmark, Books, Book, BookOpen, GraduationCap, Briefcase, Camera, Image,
  Lock, LockKey, Eye, Gear, GearSix, GearFine, Sliders, Sparkle, Confetti,
  CheckCircle, CheckFat, Checks, Warning, Info, PawPrint, Dog,
  MagnifyingGlass, Funnel, FunnelSimple, SortAscending, SortDescending,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ArrowClockwise, ArrowCounterClockwise, ArrowSquareOut, ArrowsOut, ArrowsIn,
  PlusCircle, XCircle, MinusCircle, DotsThree, DotsThreeVertical, Question,
  LinkSimple, Copy, Upload, Download, Share, Trash, TrashSimple,
  Medal, Crown, Diamond,
  // Devices & tech
  Laptop, DeviceMobile, DeviceTablet, Monitor, Printer, Headphones, Microphone,
  MusicNote, Barcode, QrCode, Bluetooth, Network,
  // Animals (additional)
  Bird, Cat, Horse, Butterfly,
  type Icon as PhosphorIconType,
} from "@phosphor-icons/react";

export type PhosphorIcon = PhosphorIconType;

export type IconValue =
  | { kind: "emoji"; value: string }
  | { kind: "icon"; value: string };

/** Stable name -> component map. The name is the value stored as "ph:<name>". */
export const ICON_BY_NAME: Record<string, PhosphorIcon> = {
  // Documents & files
  FileText, File, FilePdf, FileDoc, Files, Folder, Note, NotePencil, Receipt,
  ClipboardText, Signature, IdentificationCard, SealCheck, ShieldCheck, Stamp,
  FilePlus, FileMinus, FileLock, FileMagnifyingGlass, FileCsv, FileXls, FileZip,
  FileImage, FileArrowDown, FileArrowUp, Archive, Clipboard, Invoice, Paperclip,
  PaperclipHorizontal, Certificate, Gavel, Scales,
  // Writing & editing
  Pen, PenNib, Pencil, PencilSimple, PencilLine, Eraser, Highlighter,
  // Property & real estate
  House, HouseLine, HouseSimple, Buildings, BuildingApartment, BuildingOffice,
  Storefront, Key, Door, Bed, Bathtub, Couch, Television, Bridge, Garage,
  Armchair, Chair, Shower, Toilet, Oven, Lamp, Towel, Rug, Table, Desk,
  Dresser, SwimmingPool, Ruler, Screwdriver,
  // Finance & payment
  CreditCard, Bank, Money, Coins, Wallet, ChartLine, ChartBar, Calculator, Tag,
  CurrencyDollar, Cardholder, Percent, ChartPie, ChartBarHorizontal, ChartDonut,
  Graph,
  // People & contacts
  Users, User, UserCircle, HandWaving, Handshake, Smiley, UsersFour, UsersThree,
  Person, AddressBook, AddressBookTabs,
  // Communication
  Envelope, Phone, ChatCircle, ChatsCircle, Megaphone, Bell,
  EnvelopeOpen, Mailbox, PhoneCall, BellRinging, BellSlash, BellZ,
  ChatText, ChatDots,
  // Home systems & amenities
  WifiHigh, Lightbulb, Thermometer, Snowflake, Fire, Drop, Plugs, Wrench, Hammer,
  Toolbox, Broom, PaintRoller, Lightning,
  FireSimple, FireExtinguisher, Pipe, PipeWrench,
  // Time & calendar
  Calendar, Clock, CalendarBlank, CalendarCheck, CalendarPlus, Alarm, Hourglass,
  // Travel & location
  MapPin, Compass, Car, Airplane, Suitcase, Sun, Moon, Tree,
  Leaf, Plant, Mountains, MapTrifold, Globe, City, RoadHorizon,
  Taxi, Bus, Train, Bicycle, Boat, Truck, Van, Motorcycle, Park, Anchor,
  MoonStars, SunHorizon, TreePalm, Footprints,
  // Nature & weather
  CloudSun, CloudRain, Rainbow, Campfire, Flower, FlowerLotus,
  // Food & lifestyle
  ForkKnife, Coffee, Wine, ShoppingCart, Gift, Bread, Pizza, Cookie,
  Avocado, Carrot, Fish, Orange, Cake, Pepper,
  // Status & UI actions
  Star, Heart, Trophy, Target, Flag, FlagBanner,
  Bookmark, Books, Book, BookOpen, GraduationCap, Briefcase, Camera, Image,
  Lock, LockKey, Eye, Gear, GearSix, GearFine, Sliders, Sparkle, Confetti,
  CheckCircle, CheckFat, Checks, Warning, Info, PawPrint, Dog,
  MagnifyingGlass, Funnel, FunnelSimple, SortAscending, SortDescending,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ArrowClockwise, ArrowCounterClockwise, ArrowSquareOut, ArrowsOut, ArrowsIn,
  PlusCircle, XCircle, MinusCircle, DotsThree, DotsThreeVertical, Question,
  LinkSimple, Copy, Upload, Download, Share, Trash, TrashSimple,
  Medal, Crown, Diamond,
  // Devices & tech
  Laptop, DeviceMobile, DeviceTablet, Monitor, Printer, Headphones, Microphone,
  MusicNote, Barcode, QrCode, Bluetooth, Network,
  // Animals (additional)
  Bird, Cat, Horse, Butterfly,
};
