export type LogoVariant = "black" | "white" | "mark";

export const LOGO_VIEWBOX = 512;
export const LOGO_CENTER = LOGO_VIEWBOX / 2;
export const LOGO_OUTER_RADIUS = 230;
export const LOGO_INNER_RADIUS = 194;
export const LOGO_INNER_OFFSET = 54;

export function logoSvg(variant: LogoVariant): string {
  if (variant === "mark") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}" fill="none">
  <defs>
    <mask id="relunar-mark">
      <rect width="${LOGO_VIEWBOX}" height="${LOGO_VIEWBOX}" fill="white"/>
      <circle cx="${LOGO_CENTER + LOGO_INNER_OFFSET}" cy="${LOGO_CENTER}" r="${LOGO_INNER_RADIUS}" fill="black"/>
    </mask>
  </defs>
  <circle cx="${LOGO_CENTER}" cy="${LOGO_CENTER}" r="${LOGO_OUTER_RADIUS}" fill="currentColor" mask="url(#relunar-mark)"/>
</svg>`;
  }

  const background = variant === "white" ? "#000000" : "#FFFFFF";
  const foreground = variant === "white" ? "#FFFFFF" : "#000000";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}" fill="none">
  <rect width="${LOGO_VIEWBOX}" height="${LOGO_VIEWBOX}" fill="${background}"/>
  <circle cx="${LOGO_CENTER}" cy="${LOGO_CENTER}" r="${LOGO_OUTER_RADIUS}" fill="${foreground}"/>
  <circle cx="${LOGO_CENTER + LOGO_INNER_OFFSET}" cy="${LOGO_CENTER}" r="${LOGO_INNER_RADIUS}" fill="${background}"/>
</svg>`;
}
