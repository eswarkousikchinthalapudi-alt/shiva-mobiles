import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { LANG_COOKIE, dictionaries, isLang, type Lang } from "./dictionaries";

export const getLang = cache(async (): Promise<Lang> => {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : "en";
});

export async function getT() {
  const lang = await getLang();
  return { t: dictionaries[lang], lang };
}
