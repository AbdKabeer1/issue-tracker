import { PAGE_CONTAINER_CLASS } from "./page-container";

const NORMAL_MAIN =
  `${PAGE_CONTAINER_CLASS} min-w-0 flex-1 overflow-x-clip py-6 outline-none max-lg:pb-28 max-sm:px-2 max-sm:pt-2.5 sm:px-6 sm:py-8 max-lg:sm:pb-28`;

const FULL_BLEED_MAIN =
  "min-w-0 flex-1 overflow-x-clip outline-none max-w-none p-0 max-lg:pb-28";

export function shellMainClass(fullBleed = false): string {
  return fullBleed ? FULL_BLEED_MAIN : NORMAL_MAIN;
}
