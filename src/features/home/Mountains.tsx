/** Decorative layered mountain landscape for the home header. */
export function Mountains() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] w-full"
      viewBox="0 0 430 150"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="mtn-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6E8FC4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#2A4F86" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="mtn-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3D5F96" stopOpacity="0.9" />
          <stop offset="1" stopColor="#1C3A66" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="mtn-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A3560" />
          <stop offset="1" stopColor="#13294A" />
        </linearGradient>
      </defs>
      <path d="M0 95 L40 62 L70 80 L118 30 L150 58 L190 22 L232 64 L268 40 L312 72 L352 34 L392 60 L430 44 L430 150 L0 150Z" fill="url(#mtn-far)" />
      {/* snow caps */}
      <path d="M118 30 L108 40 L116 38 L122 44 L128 38Z M190 22 L180 33 L188 31 L194 37 L200 31Z M352 34 L343 44 L351 42 L357 47 L362 42Z" fill="#E8EEF8" opacity="0.55" />
      <path d="M0 115 L52 84 L88 100 L140 68 L188 98 L236 74 L286 102 L330 80 L380 104 L430 86 L430 150 L0 150Z" fill="url(#mtn-mid)" />
      <path d="M0 138 L60 116 L120 130 L190 110 L260 132 L320 116 L380 134 L430 122 L430 150 L0 150Z" fill="url(#mtn-near)" />
    </svg>
  );
}
