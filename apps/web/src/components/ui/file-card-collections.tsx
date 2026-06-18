import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type FormatFileProps =
  | "doc"
  | "pdf"
  | "md"
  | "mdx"
  | "csv"
  | "xls"
  | "xlsx"
  | "txt"
  | "ppt"
  | "pptx"
  | "zip"
  | "rar"
  | "tar"
  | "gz"
  | "code"
  | "html"
  | "js"
  | "jsx"
  | "tsx"
  | "css"
  | "json"
  | "img"
  | "png"
  | "jpg"
  | "jpeg"
  | "video";

type FileCardProps = {
  formatFile: FormatFileProps;
  badgeLabel?: string;
  className?: string;
};

const DefaultPlaceholder = () => {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="h-0.5 w-1/2 rounded-full bg-foreground/20" />
      </div>
      <div className="flex gap-1">
        <div className="h-0.5 w-1/3 rounded-full bg-foreground/10" />
        <div className="h-0.5 w-1/3 rounded-full bg-foreground/10" />
      </div>
      <div className="flex gap-1">
        <div className="h-0.5 w-1/2 rounded-full bg-foreground/10" />
        <div className="h-0.5 w-1/3 rounded-full bg-foreground/10" />
      </div>
      <div className="flex gap-1">
        <div className="h-0.5 w-1/3 rounded-full bg-foreground/10" />
        <div className="h-0.5 w-1/3 rounded-full bg-foreground/10" />
      </div>
      <div className="flex gap-1">
        <div className="h-0.5 w-1/3 rounded-full bg-foreground/10" />
        <div className="h-0.5 w-1/2 rounded-full bg-foreground/10" />
      </div>
      <div className="flex gap-1">
        <div className="h-0.5 w-1/3 rounded-full bg-foreground/10" />
      </div>
    </div>
  );
};

const colorBannerMap: Record<FormatFileProps, string> = {
  doc: "bg-blue-500 text-white",
  pdf: "bg-red-500 text-white",
  md: "bg-neutral-600 text-white",
  mdx: "bg-neutral-600 text-white",
  txt: "bg-gray-500 text-white",
  csv: "bg-teal-700 text-white",
  xls: "bg-emerald-600 text-white",
  xlsx: "bg-emerald-600 text-white",
  ppt: "bg-orange-500 text-white",
  pptx: "bg-orange-500 text-white",
  zip: "bg-purple-500 text-white",
  rar: "bg-purple-600 text-white",
  tar: "bg-yellow-600 text-white",
  gz: "bg-yellow-700 text-white",
  html: "bg-orange-600 text-white",
  js: "bg-yellow-600 text-white",
  jsx: "bg-blue-600 text-white",
  css: "bg-blue-600 text-white",
  json: "bg-yellow-500 text-white",
  tsx: "bg-blue-600 text-white",
  code: "bg-orange-600 text-white",
  img: "bg-pink-500 text-white",
  png: "bg-neutral-600 text-white",
  jpg: "bg-green-700 text-white",
  jpeg: "bg-green-700 text-white",
  video: "bg-green-700 text-white",
};

export const FileCard = ({ formatFile, badgeLabel, className }: FileCardProps) => {
  const colorBannerClass = colorBannerMap[formatFile];
  let filePlaceholder: ReactNode = <DefaultPlaceholder />;

  if (formatFile === "md" || formatFile === "mdx") {
    filePlaceholder = (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <div className="text-[10px] font-bold text-foreground/30">#</div>
          <div className="h-0.5 w-6 rounded-full bg-foreground/20" />
        </div>
        <div className="space-y-1">
          <div className="h-0.5 w-1/3 rounded-full bg-foreground/10" />
          <div className="h-0.5 w-7 rounded-full bg-foreground/10" />
        </div>
        <div className="space-y-1">
          <div className="h-0.5 w-8 rounded-full bg-foreground/10" />
          <div className="h-0.5 w-4 rounded-full bg-foreground/10" />
          <div className="h-0.5 w-1/3 rounded-full bg-foreground/10" />
        </div>
      </div>
    );
  }

  if (formatFile === "xls" || formatFile === "xlsx") {
    filePlaceholder = (
      <div className="space-y-0.5">
        <div className="grid grid-cols-3 gap-0.5">
          <div className="h-2 bg-foreground/20" />
          <div className="h-2 bg-foreground/20" />
          <div className="h-2 bg-foreground/20" />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          <div className="h-2 bg-foreground/5" />
          <div className="h-2 bg-foreground/5" />
          <div className="h-2 bg-foreground/5" />
          <div className="h-2 bg-foreground/5" />
          <div className="h-2 bg-foreground/5" />
          <div className="h-2 bg-foreground/5" />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          <div className="h-2 bg-foreground/5" />
          <div className="h-2 bg-foreground/5" />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          <div className="h-2 bg-foreground/5" />
        </div>
      </div>
    );
  }

  if (formatFile === "csv") {
    filePlaceholder = (
      <>
        <div className="mb-2">
          <div className="grid grid-cols-3 gap-0.5">
            <div className="h-1.5 rounded-full bg-foreground/20" />
            <div className="h-1.5 rounded-full bg-foreground/20" />
            <div className="h-1.5 rounded-full bg-foreground/20" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-0.5">
            <div className="h-1 rounded-full bg-foreground/5" />
            <div className="h-1 rounded-full bg-foreground/5" />
            <div className="h-1 rounded-full bg-foreground/5" />
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            <div className="h-1 rounded-full bg-foreground/5" />
            <div className="h-1 rounded-full bg-foreground/5" />
            <div className="h-1 rounded-full bg-foreground/5" />
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            <div className="h-1 rounded-full bg-foreground/5" />
            <div className="h-1 rounded-full bg-foreground/5" />
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            <div className="h-1 rounded-full bg-foreground/5" />
          </div>
        </div>
      </>
    );
  }

  if (formatFile === "zip" || formatFile === "rar" || formatFile === "tar" || formatFile === "gz") {
    filePlaceholder = (
      <div className="relative flex h-full flex-col items-center justify-center">
        <div>
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="flex overflow-hidden rounded-full">
              <div className={cn("size-1.5", index % 2 === 0 ? "bg-foreground/20" : "bg-foreground/5")} />
              <div className={cn("size-1.5", index % 2 === 0 ? "bg-foreground/5" : "bg-foreground/20")} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (formatFile === "ppt" || formatFile === "pptx") {
    filePlaceholder = (
      <>
        <div className="mb-1.5 space-y-1 rounded border bg-foreground/5 p-1">
          <div className="flex justify-center gap-1">
            <div className="size-3 rounded-sm bg-orange-400/40" />
          </div>
          <div className="mx-auto h-0.75 w-8 rounded-full bg-foreground/15" />
        </div>
        <div className="mb-1 flex justify-center gap-1">
          <div className="h-0.75 w-8 rounded-full bg-foreground/15" />
          <div className="h-0.75 w-4 rounded-full bg-foreground/15" />
        </div>
        <div className="space-y-1">
          <div className="h-0.75 w-4 rounded-full bg-foreground/15" />
          <div className="h-0.75 w-5 rounded-full bg-foreground/15" />
        </div>
      </>
    );
  }

  if (formatFile === "img" || formatFile === "png" || formatFile === "jpg" || formatFile === "jpeg") {
    filePlaceholder = (
      <div className="mb-1.5 space-y-1 rounded border bg-foreground/5 p-1">
        <div className="flex justify-center gap-1">
          <div className="size-3 rounded-sm bg-yellow-400/40" />
        </div>
        <div className="mx-auto mt-1 h-0.75 w-4 rounded-full bg-foreground/15" />
        <div className="mx-auto h-0.75 w-8 rounded-full bg-foreground/15" />
      </div>
    );
  }

  if (formatFile === "video") {
    filePlaceholder = (
      <div className="mb-1.5 space-y-1 rounded border bg-foreground/5 p-1">
        <div className="flex justify-center gap-1">
          <div className="size-0 border-y-[5px] border-l-8 border-y-transparent border-l-green-400/60" />
        </div>
        <div className="mx-auto mt-1 h-0.75 w-4 rounded-full bg-foreground/15" />
        <div className="mx-auto h-0.75 w-8 rounded-full bg-foreground/15" />
      </div>
    );
  }

  if (formatFile === "html" || formatFile === "js" || formatFile === "jsx" || formatFile === "tsx" || formatFile === "code") {
    filePlaceholder = (
      <div className="space-y-1">
        {["emerald", "sky", "sky", "emerald"].map((tone, index) => (
          <div key={`${tone}-${index}`} className={cn("flex items-center gap-0.5", index === 1 || index === 2 ? "pl-1" : "")}>
            <div className="font-mono text-[5px] text-foreground/30">{index === 2 ? "</" : "<"}</div>
            <div className={cn("h-0.75 rounded-full", index === 3 ? "w-1" : index === 0 ? "w-3" : "w-2.5", tone === "sky" ? "bg-sky-400/60" : "bg-emerald-400/60")} />
            <div className="font-mono text-[5px] text-foreground/30">{index === 3 ? "/>" : ">"}</div>
          </div>
        ))}
      </div>
    );
  }

  if (formatFile === "css" || formatFile === "json") {
    const tone = formatFile === "css" ? "bg-sky-400/60" : "bg-foreground/20";
    filePlaceholder = (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <div className="font-mono text-[6px] text-foreground/40">{"{"}</div>
        </div>
        {[3, 4, 3].map((width, index) => (
          <div key={`${width}-${index}`} className="flex items-center gap-1 pl-1.5">
            <div className={cn("h-0.75 rounded-full", width === 4 ? "w-4" : "w-3", tone)} />
            <div className={cn("h-0.75 rounded-full", index === 1 ? "w-2" : "w-4", tone)} />
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="font-mono text-[6px] text-foreground/40">{"}"}</div>
        </div>
      </div>
    );
  }

  const sizeClass = "h-18 w-14";

  return (
    <div aria-hidden className={cn("relative size-fit", className)}>
      <div
        className={cn(
          "absolute -right-2 bottom-1.5 z-2 rounded px-1.5 py-0.5 text-[8px] font-medium uppercase shadow-sm",
          colorBannerClass,
        )}
      >
        {badgeLabel ?? formatFile}
      </div>
      <div
        className={cn(
          "relative z-1 space-y-3 rounded-md bg-white p-2 ring-1 ring-border dark:bg-secondary",
          sizeClass,
        )}
      >
        {filePlaceholder}
      </div>
    </div>
  );
};

export default FileCard;
