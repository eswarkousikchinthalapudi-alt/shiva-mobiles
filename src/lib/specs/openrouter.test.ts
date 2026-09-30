import { afterEach, describe, expect, it, vi } from "vitest";
import { aiLookupEnabled, extractJson, lookupWithAi, toModelInput } from "./openrouter";

const answer = {
  found: true,
  brand: "Realme",
  name: "11 Pro 5G",
  model_numbers: ["RMX3771"],
  os: "Android",
  launch_year: 2023,
  chipset: "MediaTek Dimensity 7050",
  performance_tier: 3,
  display_inches: 6.7,
  display_type: "AMOLED",
  refresh_hz: 120,
  main_camera_mp: 100,
  camera_summary: "100MP + 2MP depth",
  front_camera_mp: 16,
  battery_mah: 5000,
  charging_w: 67,
  has_5g: true,
  variants: [
    { ram_gb: 8, storage_gb: 128, launch_price_inr: 23999 },
    { ram_gb: 8, storage_gb: 256, launch_price_inr: 24999 },
    { ram_gb: 8, storage_gb: 256, launch_price_inr: 24999 },
    { ram_gb: 12, storage_gb: 256, launch_price_inr: 27999 },
  ],
  source_urls: ["https://www.91mobiles.com/realme-11-pro-5g-price-in-india", "javascript:alert(1)", "http://insecure.example"],
};

describe("toModelInput", () => {
  it("maps the answer to catalog fields", () => {
    expect(toModelInput(answer, ["https://www.smartprix.com/mobiles/realme-11-pro"])).toEqual({
      brand: "Realme",
      name: "11 Pro 5G",
      aliases: ["RMX3771"],
      os: "Android",
      launchYear: 2023,
      chipset: "Dimensity 7050",
      performance: 3,
      displayInches: 6.7,
      displayType: "AMOLED",
      refreshHz: 120,
      mainCameraMp: 100,
      cameraSummary: "100MP + 2MP depth",
      frontCameraMp: 16,
      batteryMah: 5000,
      chargingW: 67,
      has5g: true,
      variants: [
        { ramGb: 8, storageGb: 128, launchPriceInr: 23999 },
        { ramGb: 8, storageGb: 256, launchPriceInr: 24999 },
        { ramGb: 12, storageGb: 256, launchPriceInr: 27999 },
      ],
      sourceUrls: ["https://www.91mobiles.com/realme-11-pro-5g-price-in-india", "https://www.smartprix.com/mobiles/realme-11-pro"],
    });
  });

  it("drops values that are out of range instead of failing", () => {
    const specs = toModelInput({ ...answer, refresh_hz: 0, battery_mah: 99999, display_inches: 65, launch_year: 1999 });
    expect(specs).toMatchObject({ refreshHz: null, batteryMah: null, displayInches: null, launchYear: null });
  });

  it("returns null when the phone wasn't found", () => {
    expect(toModelInput({ ...answer, found: false })).toBeNull();
    expect(toModelInput({ nonsense: true })).toBeNull();
  });
});

describe("extractJson", () => {
  it("reads JSON even inside code fences", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("lookupWithAi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is off without a key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(aiLookupEnabled()).toBe(false);
    expect((await lookupWithAi("Galaxy A54")).ok).toBe(false);
  });

  it("asks OpenRouter with web search and a JSON schema, then reads the answer", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify(answer),
                  annotations: [{ type: "url_citation", url_citation: { url: "https://www.gadgets360.com/realme-11-pro-5g" } }],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await lookupWithAi("  RMX3771\u0000 ");
    expect(result).toMatchObject({ ok: true, specs: { brand: "Realme", name: "11 Pro 5G" } });
    expect(result.ok && result.specs.sourceUrls).toContain("https://www.gadgets360.com/realme-11-pro-5g");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer sk-or-test");
    const body = JSON.parse(String(init.body));
    expect(body.models).toEqual(["~google/gemini-flash-latest", "google/gemini-2.5-flash"]);
    expect(body.plugins[0]).toMatchObject({ id: "web", engine: "exa" });
    expect(body.plugins[0].include_domains).not.toContain("gsmarena.com");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.messages[1].content).toBe("RMX3771 phone specifications");
  });

  it("uses OPENROUTER_MODEL when set", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubEnv("OPENROUTER_MODEL", "openai/some-model");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await lookupWithAi("Realme 11 Pro");
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.models).toEqual(["openai/some-model", "google/gemini-2.5-flash"]);
  });

  it("explains a bad key or an empty account", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "No auth", code: 401 } }), { status: 401 })),
    );
    expect(await lookupWithAi("Galaxy A54")).toMatchObject({ ok: false, error: expect.stringMatching(/not valid/) });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Insufficient credits", code: 402 } }), { status: 402 })),
    );
    expect(await lookupWithAi("Galaxy A54")).toMatchObject({ ok: false, error: expect.stringMatching(/out of credit/) });
  });
});
