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
  type Icon as PhosphorIconType,
} from "@phosphor-icons/react";

export type PhosphorIcon = PhosphorIconType;

export type IconValue =
  | { kind: "emoji"; value: string }
  | { kind: "icon"; value: string };

/** Stable name -> component map. The name is the value stored as "ph:<name>". */
export const ICON_BY_NAME: Record<string, PhosphorIcon> = {
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
};
