"use client";

import { useState } from "react";
import { formatImageDataUrl } from "@/utils";
import Image from "next/image";

interface GameImageProps {
  imageBase64?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}

export default function GameImage({
  imageBase64,
  mimeType = "image/png",
  width,
  height,
  alt = "Imagen de la historia",
  className = "",
  fallback,
}: GameImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!imageBase64) {
    return fallback ? <>{fallback}</> : null;
  }

  const imageUrl = formatImageDataUrl(imageBase64, mimeType);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="text-center">
          <div className="text-4xl mb-2">🖼️</div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Error al cargar la imagen
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mb-2"></div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Cargando imagen...
            </p>
          </div>
        </div>
      )}
      {width && height ? (
        <Image
          src={imageUrl}
          alt={alt}
          width={width}
          height={height}
          unoptimized
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-auto rounded-lg shadow-lg transition-opacity duration-300 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
          style={{ aspectRatio: `${width} / ${height}` }}
        />
      ) : (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes="100vw"
          unoptimized
          onLoad={handleLoad}
          onError={handleError}
          className={`object-contain rounded-lg shadow-lg transition-opacity duration-300 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      {/* Overlay con información de la imagen en desarrollo */}
      {process.env.NODE_ENV === "development" && !isLoading && !hasError && (
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
          {mimeType} {width && height && `${width}×${height}`}
        </div>
      )}
    </div>
  );
}

// Componente para mostrar placeholder cuando no hay imagen
export function ImagePlaceholder({
  className = "",
  message = "Sin imagen disponible",
}: {
  className?: string;
  message?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 ${className}`}
    >
      <div className="text-center">
        <div className="text-6xl mb-4 opacity-50">🎨</div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
      </div>
    </div>
  );
}

// Componente específico para el estado de carga de imágenes
export function ImageLoading({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg ${className}`}
    >
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-purple-200 dark:border-purple-800 border-t-purple-500 rounded-full animate-spin mb-4"></div>
        <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">
          Generando imagen...
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
          Esto puede tomar unos momentos
        </p>
      </div>
    </div>
  );
}
