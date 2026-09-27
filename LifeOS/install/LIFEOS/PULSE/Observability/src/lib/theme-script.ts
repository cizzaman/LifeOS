/** Server-safe half of the theme module: the storage key and the pre-paint script for layout.tsx. */

export const THEME_KEY = "pulse-theme";

/** Pre-paint: applies the stored theme before first render so a reload never flashes the other ground. */
export function themeScript(): string {
  return `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_KEY)})==="light"?"light":"dark";
var d=document.documentElement;
d.setAttribute("data-theme",t);
d.classList.toggle("dark",t==="dark");
d.style.colorScheme=t;
}catch(e){}})()`;
}
