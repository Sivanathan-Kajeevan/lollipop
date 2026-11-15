import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface FoodImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function FoodImage({ src, alt, className = '' }: FoodImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F4EFE6] to-[#EAE2D6] text-[#57534E] ${className}`}
        role="img"
        aria-label={alt}
      >
        <UtensilsCrossed className="h-8 w-8 text-[#B91C1C]/60" aria-hidden="true" />
        <span className="mt-2 px-3 text-center text-xs font-medium text-[#57534E] line-clamp-1">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
