import { afterEach, describe, expect, it, vi } from "vitest";
import { aiLookupEnabled, chosenModel, extractJson, extractWithAi, FREE_MODELS, lookupWithAi, modelOrder, toModelInput } from "./openrouter";

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
    { ram_gb: 8, storage_gb: 128 },
    { ram_gb: 8, storage_gb: 256 },
    { ram_gb: 8, storage_gb: 256 },
    { ram_gb: 12, storage_gb: 256 },
  ],
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const reply = (content: string, model = "google/gemma-4-31b-it:free") => ok({ model, choices: [{ message: { content } }] });

describe("toModelInput", () => {
  it("maps the answer to catalog fields", () => {
    expect(toModelInput(answer)).toEqual({
      ok: true,
      specs: {
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
          { ramGb: 8, storageGb: 128, launchPriceInr: null },
          { ramGb: 8, storageGb: 256, launchPriceInr: null },
          { ramGb: 12, storageGb: 256, launchPriceInr: null },
        ],
        sourceUrls: [],
      },
    });
  });

  it("reads loosely written answers from free models", () => {
    const result = toModelInput({
      ...answer,
      found: "true",
      os: "android 13",
      battery_mah: "5,000 mAh",
      charging_w: "67W",
      has_5g: "yes",
      variants: [{ ram_gb: "8GB", storage_gb: "1TB" }],
    });
    expect(result).toMatchObject({ ok: true, specs: { batteryMah: 5000, chargingW: 67, has5g: true, variants: [{ ramGb: 8, storageGb: 1024 }] } });
  });

  it("drops values that are out of range instead of failing", () => {
    const result = toModelInput({ ...answer, refresh_hz: 0, battery_mah: 99999, display_inches: 65, launch_year: 1999 });
    expect(result).toMatchObject({ ok: true, specs: { refreshHz: null, batteryMah: null, displayInches: null, launchYear: null } });
  });

  it("tells 'doesn't know the phone' apart from an unreadable answer", () => {
    expect(toModelInput({ ...answer, found: false })).toEqual({ ok: false, reason: "not-found" });
    expect(toModelInput({ nonsense: true })).toEqual({ ok: false, reason: "unreadable" });
    expect(toModelInput(null)).toEqual({ ok: false, reason: "unreadable" });
  });
});

describe("extractJson", () => {
  it("reads JSON even inside code fences or with words around it", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a": 1} Hope it helps')).toEqual({ a: 1 });
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("free models only", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("tries good free models in order, or a chosen :free model first, and never a paid one", () => {
    vi.stubEnv("OPENROUTER_MODEL", "");
    expect(chosenModel()).toBe("nvidia/nemotron-3-super-120b-a12b:free");
    expect(modelOrder()).toEqual(FREE_MODELS);
    expect(FREE_MODELS.every((m) => m === "openrouter/free" || m.endsWith(":free"))).toBe(true);
    vi.stubEnv("OPENROUTER_MODEL", "google/gemma-4-31b-it:free");
    expect(modelOrder()[0]).toBe("google/gemma-4-31b-it:free");
    expect(modelOrder()).toHaveLength(FREE_MODELS.length);
    vi.stubEnv("OPENROUTER_MODEL", "google/gemini-2.5-flash");
    expect(modelOrder()).toEqual(FREE_MODELS);
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

  it("asks a free model with a zero price cap and no paid web search, then reads the answer", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubEnv("OPENROUTER_MODEL", "");
    const fetchMock = vi.fn(async () => reply(JSON.stringify(answer)));
    vi.stubGlobal("fetch", fetchMock);
    const result = await lookupWithAi("  RMX3771\u0000 ");
    expect(result).toMatchObject({ ok: true, specs: { brand: "Realme", name: "11 Pro 5G" } });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer sk-or-test");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("nvidia/nemotron-3-super-120b-a12b:free");
    expect(body.models).toEqual(FREE_MODELS);
    expect(body.plugins).toBeUndefined();
    expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0, request: 0, image: 0 });
    expect(body.response_format.type).toBe("json_schema");
    expect(body.messages[1].content).toBe("Phone: RMX3771");
  });

  it("moves on to the next model when an answer can't be read", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubEnv("OPENROUTER_MODEL", "");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply("Sure! Here are the specs you asked for.", "liquid/lfm-2.5-2.6b:free"))
      .mockResolvedValueOnce(reply(JSON.stringify(answer), "google/gemma-4-31b-it:free"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await extractWithAi("System-on-chip: Dimensity 7050\nBattery: 5000 mAh", "Realme 11 Pro 5G");
    expect(result).toMatchObject({ ok: true, specs: { brand: "Realme" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(second.model).toBe(FREE_MODELS[1]);
    expect(second.models).toEqual(FREE_MODELS.slice(1));
  });

  it("gives up after three unreadable answers and names the models", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubEnv("OPENROUTER_MODEL", "");
    const fetchMock = vi.fn(async () => reply("nonsense", "liquid/lfm-2.5-2.6b:free"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await lookupWithAi("Galaxy A54");
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't be read.*Details: liquid/) });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("says when the free AI doesn't know the phone", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply(JSON.stringify({ ...answer, found: false }))),
    );
    expect(await lookupWithAi("Galaxy S26 Ultra")).toMatchObject({ ok: false, error: expect.stringMatching(/doesn't know this phone/) });
  });

  it("explains a bad key, busy free models and the privacy setting", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "No auth", code: 401 } }), { status: 401 })),
    );
    expect(await lookupWithAi("Galaxy A54")).toMatchObject({ ok: false, error: expect.stringMatching(/not valid/) });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Rate limit exceeded: free-models-per-min", code: 429 } }), { status: 429 })),
    );
    expect(await lookupWithAi("Galaxy A54")).toMatchObject({ ok: false, error: expect.stringMatching(/busy/) });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "No endpoints found matching your data policy (Free model publication)", code: 404 } }), {
            status: 404,
          }),
      ),
    );
    expect(await lookupWithAi("Galaxy A54")).toMatchObject({ ok: false, error: expect.stringMatching(/openrouter\.ai\/settings\/privacy/) });
  });
});
