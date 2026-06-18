"use client";

// Marks
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
  SuperscriptPlugin,
  SubscriptPlugin,
  HighlightPlugin,
  // Headings
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  H6Plugin,
  // Block nodes
  BlockquotePlugin,
  HorizontalRulePlugin,
} from "@platejs/basic-nodes/react";

// Style marks / blocks
import {
  FontColorPlugin,
  FontBackgroundColorPlugin,
  FontFamilyPlugin,
  FontSizePlugin,
  FontWeightPlugin,
  LineHeightPlugin,
  TextAlignPlugin,
} from "@platejs/basic-styles/react";

// Indent
import { IndentPlugin } from "@platejs/indent/react";

// List (classic)
import {
  ListPlugin,
  BulletedListPlugin,
  NumberedListPlugin,
  ListItemPlugin,
  ListItemContentPlugin,
  TaskListPlugin,
} from "@platejs/list-classic/react";

// Table
import {
  TablePlugin,
  TableRowPlugin,
  TableCellPlugin,
  TableCellHeaderPlugin,
} from "@platejs/table/react";

// Code block
import { CodeBlockPlugin, CodeLinePlugin } from "@platejs/code-block/react";

// Link
import { LinkPlugin } from "@platejs/link/react";

// Media
import { ImagePlugin } from "@platejs/media/react";

// Core
import { ParagraphPlugin } from "platejs/react";

// Local
import { PageBreakPlugin } from "./page-break";
import {
  H1El,
  H2El,
  H3El,
  H4El,
  H5El,
  H6El,
  PEl,
  BlockquoteEl,
  HrEl,
  UlEl,
  OlEl,
  LiEl,
  LicEl,
  CodeBlockEl,
  CodeLineEl,
  LinkEl,
  ImageEl,
} from "./element-components";

export const EDITOR_PLUGINS = [
  // Marks (no component needed — leaf-level)
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
  SuperscriptPlugin,
  SubscriptPlugin,
  HighlightPlugin,

  // Style marks / blocks (no component override needed)
  FontColorPlugin,
  FontBackgroundColorPlugin,
  FontFamilyPlugin,
  FontSizePlugin,
  FontWeightPlugin,
  LineHeightPlugin,
  TextAlignPlugin,
  IndentPlugin,

  // Headings
  H1Plugin.withComponent(H1El),
  H2Plugin.withComponent(H2El),
  H3Plugin.withComponent(H3El),
  H4Plugin.withComponent(H4El),
  H5Plugin.withComponent(H5El),
  H6Plugin.withComponent(H6El),

  // Paragraph
  ParagraphPlugin.withComponent(PEl),

  // Block nodes
  BlockquotePlugin.withComponent(BlockquoteEl),
  HorizontalRulePlugin.withComponent(HrEl),

  // Lists (classic)
  ListPlugin,
  BulletedListPlugin.withComponent(UlEl),
  NumberedListPlugin.withComponent(OlEl),
  ListItemPlugin.withComponent(LiEl),
  ListItemContentPlugin.withComponent(LicEl),
  TaskListPlugin,

  // Table
  TablePlugin,
  TableRowPlugin,
  TableCellPlugin,
  TableCellHeaderPlugin,

  // Code block
  CodeBlockPlugin.withComponent(CodeBlockEl),
  CodeLinePlugin.withComponent(CodeLineEl),

  // Link
  LinkPlugin.withComponent(LinkEl),

  // Media
  ImagePlugin.withComponent(ImageEl),

  // Page break (custom void element)
  PageBreakPlugin,
];
