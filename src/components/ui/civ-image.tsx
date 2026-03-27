"use client";

import Image from "next/image";
import { useState } from "react";

interface CivImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

/** Renders a civilization icon with a graceful fallback if the CDN image 404s */
export function CivImage({
  src,
  alt,
  width = 24,
  height = 24,
  className = "",
}: CivImageProps) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div
        style={{ width, height }}
        className={`flex items-center justify-center rounded-sm bg-muted text-[10px] font-bold text-muted-foreground ${className}`}
        title={alt}
      >
        {alt.charAt(0)}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={`rounded-sm object-cover ${className}`}
      onError={() => setBroken(true)}
    />
  );
}
