/** Server-safe half of the theme module: the storage key and the pre-paint script for layout.tsx. */

export const THEME_KEY = "pulse-theme";

/** Tab and home-screen icons ship as pulse-icon-<theme>.* / pulse-touch-<theme>.png; this swaps the theme part of every icon link. */
export const ICON_SWAP = `function(t){document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]').forEach(function(l){var h=l.getAttribute("href")||"",n=h.replace(/(pulse-(?:icon|touch))-(?:dark|light)/,"$1-"+t);if(n!==h)l.setAttribute("href",n);});}`;

/** Pre-paint: applies the stored theme before first render so a reload never flashes the other ground or the other icon. */
export function themeScript(): string {
  return `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_KEY)})==="light"?"light":"dark";
var d=document.documentElement;
d.setAttribute("data-theme",t);
d.classList.toggle("dark",t==="dark");
d.style.colorScheme=t;
(${ICON_SWAP})(t);
}catch(e){}})()`;
}
