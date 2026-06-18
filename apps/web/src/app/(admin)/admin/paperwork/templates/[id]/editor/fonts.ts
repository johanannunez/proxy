export type FontDef = {
  id: string;
  label: string;
  stack: string;
  googleFamily: string;
  weights: number[];
};

export const FONTS: FontDef[] = [
  {
    id: "times-new-roman",
    label: "Times New Roman",
    googleFamily: "Tinos",
    stack: 'Tinos, "Times New Roman", serif',
    weights: [400, 700],
  },
  {
    id: "georgia",
    label: "Georgia",
    googleFamily: "Gelasio",
    stack: "Gelasio, Georgia, serif",
    weights: [400, 700],
  },
  {
    id: "pt-serif",
    label: "PT Serif",
    googleFamily: "PT Serif",
    stack: '"PT Serif", serif',
    weights: [400, 700],
  },
  {
    id: "lora",
    label: "Lora",
    googleFamily: "Lora",
    stack: "Lora, serif",
    weights: [400, 500, 600, 700],
  },
  {
    id: "merriweather",
    label: "Merriweather",
    googleFamily: "Merriweather",
    stack: "Merriweather, serif",
    weights: [300, 400, 700, 900],
  },
  {
    id: "eb-garamond",
    label: "EB Garamond",
    googleFamily: "EB Garamond",
    stack: '"EB Garamond", serif',
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: "playfair-display",
    label: "Playfair Display",
    googleFamily: "Playfair Display",
    stack: '"Playfair Display", serif',
    weights: [400, 500, 600, 700, 800, 900],
  },
  {
    id: "arial",
    label: "Arial",
    googleFamily: "Arimo",
    stack: "Arimo, Arial, sans-serif",
    weights: [400, 700],
  },
  {
    id: "roboto",
    label: "Roboto",
    googleFamily: "Roboto",
    stack: "Roboto, sans-serif",
    weights: [100, 300, 400, 500, 700, 900],
  },
  {
    id: "open-sans",
    label: "Open Sans",
    googleFamily: "Open Sans",
    stack: '"Open Sans", sans-serif',
    weights: [300, 400, 600, 700, 800],
  },
  {
    id: "lato",
    label: "Lato",
    googleFamily: "Lato",
    stack: "Lato, sans-serif",
    weights: [100, 300, 400, 700, 900],
  },
  {
    id: "montserrat",
    label: "Montserrat",
    googleFamily: "Montserrat",
    stack: "Montserrat, sans-serif",
    weights: [100, 300, 400, 500, 700, 900],
  },
  {
    id: "inter",
    label: "Inter",
    googleFamily: "Inter",
    stack: "Inter, sans-serif",
    weights: [100, 300, 400, 500, 700, 900],
  },
  {
    id: "courier-new",
    label: "Courier New",
    googleFamily: "Cousine",
    stack: 'Cousine, "Courier New", monospace',
    weights: [400, 700],
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    googleFamily: "JetBrains Mono",
    stack: '"JetBrains Mono", monospace',
    weights: [100, 300, 400, 700, 800],
  },
];

export const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 24, 30, 36]; // pt

export function googleFontsHref(font: FontDef): string {
  const family = font.googleFamily.replace(/ /g, "+");
  // Build ital,wght tuples for both italic=0 and italic=1 for every weight, sorted
  const tuples = font.weights
    .flatMap((w) => [`0,${w}`, `1,${w}`])
    .join(";");
  return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@${tuples}&display=swap`;
}

export function loadFont(id: string): void {
  if (typeof document === "undefined") return;
  const linkId = `font-${id}`;
  if (document.getElementById(linkId)) return;
  const font = FONTS.find((f) => f.id === id);
  if (!font) return;
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = googleFontsHref(font);
  document.head.appendChild(link);
}
