"use client";

import { useActionState, useState, useCallback } from "react";
import { UploadSimple, Star, Trash, Images, WarningCircle, Spinner } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { StepSaveBar } from "@/components/workspace/setup/StepShell";
import { savePhotos, type SavePhotosState } from "./actions";

type PhotoEntry = {
  url: string;
  isPrimary: boolean;
};

type LocalPhoto = PhotoEntry & {
  id: string;
  uploading?: boolean;
  progress?: number;
};

const initialState: SavePhotosState = {};

export function PhotosForm({
  propertyId,
  userId,
  savedPhotos,
  isEditing,
}: {
  propertyId: string;
  userId: string;
  savedPhotos: PhotoEntry[];
  isEditing: boolean;
}) {
  const [state, formAction, pending] = useActionState(savePhotos, initialState);
  const [photos, setPhotos] = useState<LocalPhoto[]>(
    savedPhotos.map((p, i) => ({
      ...p,
      id: `saved-${i}`,
    })),
  );

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return null;
    if (file.size > 10 * 1024 * 1024) return null;

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from("property-photos")
      .upload(path, file, { contentType: file.type });

    if (error) {
      console.error("[photos] Upload failed:", error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("property-photos")
      .getPublicUrl(path);

    return urlData.publicUrl;
  }, [userId, propertyId]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = 10 - photos.length;
    const batch = Array.from(files).slice(0, remaining);

    // Add placeholder entries
    const placeholders: LocalPhoto[] = batch.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      isPrimary: photos.length === 0 && batch.indexOf(file) === 0,
      uploading: true,
    }));

    setPhotos((prev) => [...prev, ...placeholders]);

    // Upload each file
    for (let i = 0; i < batch.length; i++) {
      const url = await uploadFile(batch[i]);
      const placeholderId = placeholders[i].id;

      if (url) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === placeholderId
              ? { ...p, url, uploading: false }
              : p,
          ),
        );
      } else {
        // Remove failed upload
        setPhotos((prev) => prev.filter((p) => p.id !== placeholderId));
      }
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (next.length > 0 && !next.some((p) => p.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  }

  function setPrimary(id: string) {
    setPhotos((prev) =>
      prev.map((p) => ({ ...p, isPrimary: p.id === id })),
    );
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  // Serialize for server action (only uploaded photos)
  const serializedPhotos = photos
    .filter((p) => !p.uploading)
    .map((p) => ({ url: p.url, isPrimary: p.isPrimary }));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="photos" value={JSON.stringify(serializedPhotos)} />

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
          style={{ borderColor: "#f1c4c4", backgroundColor: "#fdf4f4", color: "#8a1f1f" }}
        >
          <WarningCircle size={18} weight="fill" style={{ color: "#c0372a" }} />
          <span>{state.error}</span>
        </div>
      ) : null}

      {/* Drop zone */}
      <label
        className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors hover:bg-[var(--color-warm-gray-50)]"
        style={{ borderColor: "var(--color-warm-gray-200)" }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <UploadSimple size={32} weight="duotone" style={{ color: "var(--color-text-tertiary)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
          Drag and drop photos here, or click to browse
        </span>
        <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          Up to 10 photos. JPG, PNG, or WebP. {photos.length}/10 uploaded.
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border"
              style={{
                borderColor: photo.isPrimary ? "var(--color-brand)" : "var(--color-warm-gray-200)",
                boxShadow: photo.isPrimary ? "0 0 0 2px var(--color-brand)" : "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover"
              />
              {photo.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                  <Spinner size={24} className="animate-spin" style={{ color: "var(--color-brand)" }} />
                </div>
              )}
              {!photo.uploading && (
                <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setPrimary(photo.id)}
                    title="Set as primary"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90"
                  >
                    <Star
                      size={14}
                      weight={photo.isPrimary ? "fill" : "regular"}
                      style={{ color: photo.isPrimary ? "#f59e0b" : "#666" }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    title="Remove"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90"
                  >
                    <Trash size={14} style={{ color: "#dc2626" }} />
                  </button>
                </div>
              )}
              {photo.isPrimary && !photo.uploading && (
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold"
                  style={{ color: "var(--color-brand)" }}>
                  Primary
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8" style={{ color: "var(--color-text-tertiary)" }}>
          <Images size={40} weight="duotone" />
          <p className="text-sm">No photos uploaded yet</p>
        </div>
      )}

      <StepSaveBar pending={pending} isEditing={isEditing} />
    </form>
  );
}
