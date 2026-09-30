import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isBotCheckPage, parseGsmarenaHtml, readGsmarenaSpecs } from "./gsmarena";
import { looksLikeLink, parseGsmarenaLink } from "./link";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

describe("parseGsmarenaLink", () => {
  it("accepts phone pages from the desktop and phone sites", () => {
    for (const input of [
      "https://www.gsmarena.com/samsung_galaxy_a54-12070.php",
      "https://m.gsmarena.com/samsung_galaxy_a54-12070.php",
      "gsmarena.com/samsung_galaxy_a54-12070.php",
      "  https://www.gsmarena.com/samsung_galaxy_a54-12070.php?utm_source=x#specs  ",
    ]) {
      const result = parseGsmarenaLink(input);
      expect(result).toEqual({ ok: true, link: { slug: "samsung_galaxy_a54", id: "12070", url: "https://www.gsmarena.com/samsung_galaxy_a54-12070.php" } });
    }
  });

  it("turns pictures, opinions and price pages into the specs page", () => {
    for (const suffix of ["pictures", "reviews", "price"]) {
      const result = parseGsmarenaLink(`https://www.gsmarena.com/samsung_galaxy_a54-${suffix}-12070.php`);
      expect(result.ok && result.link.url).toBe("https://www.gsmarena.com/samsung_galaxy_a54-12070.php");
    }
  });

  it("keeps + and brackets in names", () => {
    expect(parseGsmarenaLink("https://www.gsmarena.com/nothing_phone_(2a)-12386.php")).toMatchObject({ ok: true, link: { slug: "nothing_phone_(2a)" } });
    expect(parseGsmarenaLink("https://www.gsmarena.com/xiaomi_redmi_note_13_pro%2B-12580.php")).toMatchObject({
      ok: true,
      link: { slug: "xiaomi_redmi_note_13_pro+" },
    });
  });

  it("unwraps links copied from Google results", () => {
    const wrapped = "https://www.google.com/url?q=https://www.gsmarena.com/apple_iphone_13-11103.php&sa=U";
    expect(parseGsmarenaLink(wrapped)).toMatchObject({ ok: true, link: { url: "https://www.gsmarena.com/apple_iphone_13-11103.php" } });
  });

  it("refuses other sites, review articles and non-phone pages", () => {
    expect(parseGsmarenaLink("https://www.91mobiles.com/samsung-galaxy-a54-price-in-india").ok).toBe(false);
    expect(parseGsmarenaLink("https://evil.example/samsung_galaxy_a54-12070.php").ok).toBe(false);
    expect(parseGsmarenaLink("https://www.gsmarena.com.evil.example/samsung_galaxy_a54-12070.php").ok).toBe(false);
    expect(parseGsmarenaLink("https://www.gsmarena.com/samsung_galaxy_a54-review-2555.php").ok).toBe(false);
    expect(parseGsmarenaLink("https://www.gsmarena.com/samsung_galaxy_a54_long_term_review-news-60000.php").ok).toBe(false);
    expect(parseGsmarenaLink("https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=a54").ok).toBe(false);
    expect(parseGsmarenaLink("https://www.gsmarena.com/../../etc/passwd-1.php").ok).toBe(false);
    expect(parseGsmarenaLink("not a link").ok).toBe(false);
  });
});

describe("looksLikeLink", () => {
  it("tells links from phone names", () => {
    expect(looksLikeLink("https://www.gsmarena.com/samsung_galaxy_a54-12070.php")).toBe(true);
    expect(looksLikeLink("gsmarena.com/apple_iphone_13-11103.php")).toBe(true);
    expect(looksLikeLink("www.91mobiles.com/x")).toBe(true);
    expect(looksLikeLink("Galaxy A54")).toBe(false);
    expect(looksLikeLink("Redmi Note 13 Pro+ 5G")).toBe(false);
    expect(looksLikeLink("SM-A546E")).toBe(false);
  });
});

describe("parseGsmarenaHtml", () => {
  it("reads a Samsung page", () => {
    const specs = parseGsmarenaHtml(fixture("samsung_galaxy_a54-12070.html"), "https://www.gsmarena.com/samsung_galaxy_a54-12070.php");
    expect(specs).toEqual({
      brand: "Samsung",
      name: "Galaxy A54",
      aliases: ["SM-A546V", "SM-A546U", "SM-A546B", "SM-A546E", "SM-A5460", "SM-A546M", "SM-A546W"],
      os: "Android",
      launchYear: 2023,
      chipset: "Exynos 1380",
      performance: 3,
      displayInches: 6.4,
      displayType: "Super AMOLED",
      refreshHz: 120,
      mainCameraMp: 50,
      cameraSummary: "50MP + 12MP ultra-wide + 5MP macro",
      frontCameraMp: 32,
      batteryMah: 5000,
      chargingW: 25,
      has5g: true,
      variants: [
        { ramGb: 4, storageGb: 128, launchPriceInr: null },
        { ramGb: 6, storageGb: 128, launchPriceInr: null },
        { ramGb: 8, storageGb: 128, launchPriceInr: null },
        { ramGb: 6, storageGb: 256, launchPriceInr: null },
        { ramGb: 8, storageGb: 256, launchPriceInr: null },
      ],
      sourceUrls: ["https://www.gsmarena.com/samsung_galaxy_a54-12070.php"],
    });
  });

  it("reads an iPhone page (no RAM, wireless charging ignored)", () => {
    const specs = parseGsmarenaHtml(fixture("apple_iphone_13-11103.html"), "https://www.gsmarena.com/apple_iphone_13-11103.php");
    expect(specs).toMatchObject({
      brand: "Apple",
      name: "iPhone 13",
      os: "iOS",
      launchYear: 2021,
      chipset: "A15 Bionic",
      performance: 4,
      displayInches: 6.1,
      displayType: "Super Retina XDR OLED",
      refreshHz: 60,
      mainCameraMp: 12,
      cameraSummary: "12MP + 12MP ultra-wide",
      frontCameraMp: 12,
      batteryMah: 3240,
      chargingW: null,
      has5g: true,
      aliases: ["A2633", "A2482", "A2631", "A2634", "A2635"],
    });
    expect(specs?.variants.map((v) => [v.ramGb, v.storageGb])).toEqual([
      [null, 128],
      [null, 256],
      [null, 512],
    ]);
  });

  it("files Redmi phones under Redmi and cleans the chip name", () => {
    const specs = parseGsmarenaHtml(fixture("xiaomi_redmi_note_13_pro_5g-12581.html"), "https://www.gsmarena.com/xiaomi_redmi_note_13_pro_5g-12581.php");
    expect(specs).toMatchObject({
      brand: "Redmi",
      name: "Note 13 Pro 5G",
      chipset: "Snapdragon 7s Gen 2",
      performance: 3,
      displayInches: 6.67,
      displayType: "AMOLED",
      refreshHz: 120,
      mainCameraMp: 200,
      cameraSummary: "200MP + 8MP ultra-wide + 2MP macro",
      frontCameraMp: 16,
      batteryMah: 5100,
      chargingW: 67,
      has5g: true,
    });
    expect(specs?.variants).toHaveLength(5);
  });

  it("returns null for pages without a spec table", () => {
    expect(parseGsmarenaHtml("<html><body><h1>News</h1></body></html>", "https://www.gsmarena.com/x-1.php")).toBeNull();
  });
});

describe("isBotCheckPage", () => {
  it("spots the 'prove you are human' page", () => {
    expect(isBotCheckPage('<html><title>Just a moment...</title><div class="cf-turnstile"></div></html>')).toBe(true);
    expect(isBotCheckPage("<p>One quick check before you continue...</p>")).toBe(true);
    expect(isBotCheckPage(fixture("samsung_galaxy_a54-12070.html"))).toBe(false);
  });
});

describe("readGsmarenaSpecs", () => {
  afterEach(() => vi.unstubAllGlobals());

  const htmlResponse = (html: string, status = 200) => new Response(html, { status, headers: { "content-type": "text/html" } });

  it("fetches only the rebuilt GSMArena URL, with our own user agent", async () => {
    const fetchMock = vi.fn(async () => htmlResponse(fixture("xiaomi_redmi_note_13_pro_5g-12581.html")));
    vi.stubGlobal("fetch", fetchMock);
    const result = await readGsmarenaSpecs("https://m.gsmarena.com/xiaomi_redmi_note_13_pro_5g-pictures-12581.php?ref=abc");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://www.gsmarena.com/xiaomi_redmi_note_13_pro_5g-12581.php");
    expect(init.redirect).toBe("manual");
    const ua = new Headers(init.headers).get("user-agent") ?? "";
    expect(ua).toMatch(/compatible; ShivaShopCatalog\//);
    // Sites send "Mobile"/"phone" browsers to their phone site; our tool must not look like one.
    expect(ua).not.toMatch(/mobile|phone|android|iphone/i);
  });

  it("uses the saved copy for an hour", async () => {
    const fetchMock = vi.fn(async () => htmlResponse(fixture("xiaomi_redmi_note_13_pro_5g-12581.html")));
    vi.stubGlobal("fetch", fetchMock);
    const result = await readGsmarenaSpecs("https://www.gsmarena.com/xiaomi_redmi_note_13_pro_5g-12581.php");
    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows a redirect only to another GSMArena phone page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/samsung_galaxy_a54-12070.php" } }))
      .mockResolvedValueOnce(htmlResponse(fixture("samsung_galaxy_a54-12070.html")));
    vi.stubGlobal("fetch", fetchMock);
    const result = await readGsmarenaSpecs("https://www.gsmarena.com/samsung_galaxy_a54_5g-12070.php");
    expect(result).toMatchObject({ ok: true, specs: { name: "Galaxy A54" } });

    const evil = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    vi.stubGlobal("fetch", evil);
    const refused = await readGsmarenaSpecs("https://www.gsmarena.com/apple_iphone_13-11103.php");
    expect(refused.ok).toBe(false);
    expect(evil).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect to the phone site exactly, keeping cookies, and still saves the desktop link", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://m.gsmarena.com/oneplus_12r-12800.php", "set-cookie": "gsm_pref=m; Path=/; HttpOnly" },
        }),
      )
      .mockResolvedValueOnce(htmlResponse(fixture("xiaomi_redmi_note_13_pro_5g-12581.html")));
    vi.stubGlobal("fetch", fetchMock);
    const result = await readGsmarenaSpecs("https://www.gsmarena.com/oneplus_12r-12800.php");
    expect(result).toMatchObject({ ok: true, specs: { sourceUrls: ["https://www.gsmarena.com/oneplus_12r-12800.php"] } });
    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(secondUrl).toBe("https://m.gsmarena.com/oneplus_12r-12800.php");
    expect(new Headers(secondInit.headers).get("cookie")).toBe("gsm_pref=m");
  });

  it("stops when GSMArena sends it back and forth", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://m.gsmarena.com/oneplus_12r-12801.php" } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://www.gsmarena.com/oneplus_12r-12801.php" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await readGsmarenaSpecs("https://www.gsmarena.com/oneplus_12r-12801.php");
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/back and forth/) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("allows one trip back to the same page after a cookie check", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/oneplus_12r-12803.php", "set-cookie": "chk=ok; Path=/" } }))
      .mockResolvedValueOnce(htmlResponse(fixture("samsung_galaxy_a54-12070.html")));
    vi.stubGlobal("fetch", fetchMock);
    expect((await readGsmarenaSpecs("https://www.gsmarena.com/oneplus_12r-12803.php")).ok).toBe(true);
    expect(new Headers((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].headers).get("cookie")).toBe("chk=ok");
  });

  it("says where GSMArena sent it when that isn't a phone page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://www.gsmarena.com/" } })),
    );
    const result = await readGsmarenaSpecs("https://www.gsmarena.com/oneplus_12r-12802.php");
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/different page.*Details: 302 to www\.gsmarena\.com\//) });
  });

  it("reads a page whose heading has no data-spec (phone-site layout)", async () => {
    const html = fixture("samsung_galaxy_a54-12070.html").replace('class="specs-phone-name-title" data-spec="modelname"', 'class="section nobor"');
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => htmlResponse(html)),
    );
    expect(await readGsmarenaSpecs("https://www.gsmarena.com/samsung_galaxy_a54-99999.php")).toMatchObject({
      ok: true,
      specs: { brand: "Samsung", name: "Galaxy A54" },
    });
  });

  it("explains blocks, missing pages and busy periods", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => htmlResponse('<div class="cf-turnstile">One quick check before you continue...</div>')),
    );
    expect(await readGsmarenaSpecs("https://www.gsmarena.com/oneplus_12-12725.php")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/prove it's human/),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => htmlResponse("nope", 404)),
    );
    expect(await readGsmarenaSpecs("https://www.gsmarena.com/oneplus_12-12726.php")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/doesn't exist/),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => htmlResponse("slow down", 429)),
    );
    expect(await readGsmarenaSpecs("https://www.gsmarena.com/oneplus_12-12727.php")).toMatchObject({ ok: false, error: expect.stringMatching(/busy/) });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    expect(await readGsmarenaSpecs("https://www.gsmarena.com/oneplus_12-12728.php")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Couldn't reach/),
    });
  });
});
