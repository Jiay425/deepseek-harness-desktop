// dsh-balance — host plugin.
// Registers an exact HTTP route `/dsh-balance` on the dsh web server that
// resolves DEEPSEEK_API_KEY through the credentials seam and proxies the
// DeepSeek balance endpoint (https://api.deepseek.com/user/balance).
// The API key never leaves the host; the client only sees the balance JSON.

const name = "dsh-balance";
const inject = ["webServer", "credentials"];

const BALANCE_URL = "https://api.deepseek.com/user/balance";
const CACHE_TTL_MS = 30_000;

/** Tiny in-memory cache so multiple browser windows don't hammer the API. */
let cache = { at: 0, payload: null };

async function fetchBalance(apiKey) {
  const res = await fetch(BALANCE_URL, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {}
    throw new Error(`DeepSeek balance API returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: "/dsh-balance",
    handler: async (_req, res) => {
      const json = (body) => {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(body));
      };
      try {
        if (Date.now() - cache.at < CACHE_TTL_MS && cache.payload !== null) {
          return json(cache.payload);
        }
        const hit = await ctx.credentials.resolve("DEEPSEEK_API_KEY");
        if (hit === void 0) {
          const payload = {
            ok: false,
            error: {
              code: "NO_CREDENTIAL",
              message: "DEEPSEEK_API_KEY 未配置（在 设置 → 模型 里填写，或设置环境变量）",
            },
          };
          cache = { at: Date.now(), payload };
          return json(payload);
        }
        const data = await fetchBalance(hit.value);
        const infos = Array.isArray(data.balance_infos) ? data.balance_infos : [];
        const payload = {
          ok: true,
          value: {
            isAvailable: data.is_available === true,
            currencies: infos.map((b) => ({
              currency: b.currency,
              totalBalance: b.total_balance,
              grantedBalance: b.granted_balance,
              toppedUpBalance: b.topped_up_balance,
            })),
            fetchedAt: Date.now(),
          },
        };
        cache = { at: Date.now(), payload };
        return json(payload);
      } catch (err) {
        try {
          ctx.logger?.warn?.(err instanceof Error ? err : new Error(String(err)));
        } catch {}
        return json({
          ok: false,
          error: { code: "FETCH_FAILED", message: String(err?.message ?? err) },
        });
      }
    },
  }), "dsh-balance: register /dsh-balance route");
}

export { name, inject, apply };
