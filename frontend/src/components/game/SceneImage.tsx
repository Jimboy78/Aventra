"use client";

import { useEffect, useState } from "react";

export type ImageLoader = (id: string) => Promise<string | undefined>;

export function SceneImage({ id, prompt, load }: { id: string; prompt: string; load: ImageLoader }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    load(id).then((url) => alive && setSrc(url ?? null));
    return () => {
      alive = false;
    };
  }, [id, load]);

  return (
    <figure className="frame relative mb-5 overflow-hidden p-1.5" data-testid="scene-image">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URLs from IndexedDB
        <img src={src} alt={prompt} className="rise block aspect-[3/2] w-full object-cover [image-rendering:auto]" />
      ) : (
        <div className="skeleton aspect-[3/2] w-full" />
      )}
      <figcaption className="pointer-events-none absolute inset-x-1.5 bottom-1.5 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-[0.7rem] text-white/60">
        {prompt}
      </figcaption>
    </figure>
  );
}

export function PaintingPlaceholder() {
  return (
    <div className="frame mb-5 p-1.5" data-testid="painting">
      <div className="skeleton grid aspect-[3/2] w-full place-items-center">
        <p className="font-pixel text-[0.62rem] text-[var(--gold)]">PINTANDO LA ESCENA…</p>
      </div>
    </div>
  );
}
