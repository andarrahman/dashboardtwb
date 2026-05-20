"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  RiCloseLine,
  RiUploadLine,
  RiImageLine,
  RiDeleteBin2Line,
  RiCheckLine,
  RiRefreshLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LibraryImage {
  name: string
  fullPath: string
  url: string
}

interface ImageLibraryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onSelect: (url: string) => void
}

export function ImageLibraryModal({
  open,
  onOpenChange,
  workspaceId,
  onSelect,
}: ImageLibraryModalProps) {
  const [images, setImages] = React.useState<LibraryImage[]>([])
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [selected, setSelected] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open && workspaceId) loadImages()
    if (!open) setSelected(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId])

  async function loadImages() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from('template-images')
      .list(`${workspaceId}/library`, {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      })
    if (!error && data) {
      const imgs: LibraryImage[] = data
        .filter((f) => f.name && !f.name.endsWith('/') && f.id)
        .map((f) => {
          const fullPath = `${workspaceId}/library/${f.name}`
          const { data: urlData } = supabase.storage
            .from('template-images')
            .getPublicUrl(fullPath)
          return { name: f.name, fullPath, url: urlData.publicUrl }
        })
      setImages(imgs)
    }
    setLoading(false)
  }

  async function handleUpload(file: File) {
    if (!workspaceId) return
    setUploading(true)
    const supabase = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const path = `${workspaceId}/library/${Date.now()}-${safeName}`
    const { error } = await supabase.storage
      .from('template-images')
      .upload(path, file, { upsert: false })
    if (!error) {
      await loadImages()
    }
    setUploading(false)
  }

  async function handleDelete(img: LibraryImage, e: React.MouseEvent) {
    e.stopPropagation()
    const supabase = createClient()
    await supabase.storage.from('template-images').remove([img.fullPath])
    setImages((prev) => prev.filter((i) => i.fullPath !== img.fullPath))
    if (selected === img.url) setSelected(null)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-[720px] max-w-[calc(100vw-48px)] flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">Image Library</h2>
            <p className="text-xs text-foreground-muted mt-0.5">Pick from previously uploaded images or upload a new one</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <RiRefreshLine size={14} className="animate-spin" />
              ) : (
                <RiUploadLine size={14} />
              )}
              {uploading ? 'Uploading…' : 'Upload new'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            />
            <button
              onClick={() => onOpenChange(false)}
              className="size-8 inline-flex items-center justify-center rounded-full text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors"
            >
              <RiCloseLine size={18} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-background-subtle animate-pulse" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-foreground-muted">
              <RiImageLine size={40} className="opacity-20" />
              <p className="text-sm font-medium">No images uploaded yet</p>
              <p className="text-xs">Upload an image to get started</p>
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                <RiUploadLine size={14} />
                Upload image
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {images.map((img) => (
                <button
                  key={img.fullPath}
                  onClick={() => setSelected(img.url)}
                  className={cn(
                    "relative group aspect-square rounded-xl border-2 overflow-hidden transition-all",
                    selected === img.url
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Selection indicator */}
                  {selected === img.url && (
                    <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                      <div className="size-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <RiCheckLine size={14} className="text-white" />
                      </div>
                    </div>
                  )}
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(img, e)}
                    className="absolute top-1.5 right-1.5 size-6 rounded-lg bg-gray-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                    title="Delete"
                  >
                    <RiDeleteBin2Line size={11} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-5 pt-3 border-t border-border shrink-0">
          <p className="text-xs text-foreground-muted">
            {images.length > 0 ? `${images.length} image${images.length !== 1 ? 's' : ''}` : ''}
            {selected ? ' · 1 selected' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!selected}
              onClick={() => {
                if (selected) {
                  onSelect(selected)
                  onOpenChange(false)
                }
              }}
            >
              Use image
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
