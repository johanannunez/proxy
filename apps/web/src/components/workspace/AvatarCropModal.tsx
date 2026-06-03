"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus } from "@phosphor-icons/react";

type Props = {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
};

export function AvatarCropModal({ imageSrc, onCrop, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = new Image();
    image.crossOrigin = "anonymous";

    await new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.src = imageSrc;
    });

    // Output at 256x256 for a good balance of quality and file size
    const outputSize = 256;
    canvas.width = outputSize;
    canvas.height = outputSize;

    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      outputSize,
      outputSize,
    );

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCrop(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[440px] overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Edit photo
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-warm-gray-100)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Crop Area */}
        <div className="relative h-[320px]" style={{ backgroundColor: "#111" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom Slider */}
        <div
          className="flex items-center gap-3 border-t px-5 py-3"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <MagnifyingGlassMinus
            size={16}
            style={{ color: "var(--color-text-tertiary)" }}
          />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--color-brand)]"
          />
          <MagnifyingGlassPlus
            size={16}
            style={{ color: "var(--color-text-tertiary)" }}
          />
        </div>

        {/* Actions */}
        <div
          className="flex justify-end gap-2 border-t px-5 py-3.5"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-100)]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
}
