type ProfileAvatarProps = {
  url?: string | null;
  emoji?: string | null;
  name?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

export function ProfileAvatar({
  url,
  emoji,
  name,
  className = "h-12 w-12",
  imageClassName = "",
  fallbackClassName = "text-xl",
}: ProfileAvatarProps) {
  const label = name ? `${name} avatar` : "Profile avatar";

  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-full bg-gradient-primary ${fallbackClassName}`}>
      {url ? (
        <img
          src={url}
          alt={label}
          className={`h-full w-full object-cover ${imageClassName}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">{emoji ?? "🌴"}</div>
      )}
    </div>
  );
}