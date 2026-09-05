window.__ModuleLoader__.load({
	id: "dsh-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "dshBalance";
		const zh = {
			label: "余额",
			total: "总余额",
			granted: "赠送余额",
			toppedUp: "充值余额",
			available: "可用",
			unavailable: "不可用",
			notConfigured: "未配置 API Key",
			fetchFailed: "获取失败",
			loading: "加载中",
			refresh: "刷新",
			lastUpdate: "更新时间"
		};
		const en = {
			label: "Balance",
			total: "Total balance",
			granted: "Granted",
			toppedUp: "Topped up",
			available: "Available",
			unavailable: "Unavailable",
			notConfigured: "API key not configured",
			fetchFailed: "Failed to fetch",
			loading: "Loading",
			refresh: "Refresh",
			lastUpdate: "Updated"
		};
		const fmt = (amount) => Number(amount ?? 0).toFixed(2);
		const symbolOf = (currency) => currency === "CNY" ? "¥" : currency ?? "";
		/** Sidebar footer pill: compact balance + click popover with details. */
		function BalanceFooterAction({ t, getBalance }) {
			const [state, setState] = react.useState({ status: "loading", data: null, error: null });
			const [open, setOpen] = react.useState(false);
			const load = react.useCallback(async () => {
				setState((s) => ({ ...s, status: s.status === "ready" ? "refreshing" : "loading" }));
				try {
					const result = await getBalance();
					if (result.ok) setState({ status: "ready", data: result.value, error: null });
					else setState({ status: "error", data: null, error: result.error?.message ?? t("fetchFailed") });
				} catch (err) {
					setState({ status: "error", data: null, error: String(err?.message ?? err) });
				}
			}, [getBalance, t]);
			react.useEffect(() => {
				load();
				const timer = setInterval(load, 60_000);
				return () => clearInterval(timer);
			}, [load]);

			const currency = state.data?.currencies?.[0];
			const total = currency?.totalBalance;
			const dim = { opacity: 0.62 };
			const pillText = state.status === "loading" || state.status === "refreshing"
				? t("loading")
				: state.status === "error"
					? t("fetchFailed")
					: total === void 0
						? t("notConfigured")
						: `${symbolOf(currency.currency)} ${fmt(total)}`;
			return react_jsx_runtime.jsxs("div", {
				style: { position: "relative", display: "flex", alignItems: "center" },
				children: [
					open && react_jsx_runtime.jsxs("div", {
						style: {
							position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 999,
							minWidth: 230, padding: "10px 12px", borderRadius: 10, fontSize: 12,
							background: "var(--dsh-surface-2, #1c2128)",
							border: "1px solid var(--dsh-border, #30363d)",
							boxShadow: "0 8px 24px rgba(0,0,0,.35)",
							color: "var(--dsh-text-1, #e6edf3)"
						},
						children: [
							react_jsx_runtime.jsxs("div", {
								style: { display: "flex", justifyContent: "space-between", gap: 16, padding: "2px 0" },
								children: [
									react_jsx_runtime.jsx("span", { children: t("total") }),
									react_jsx_runtime.jsx("span", { style: { fontWeight: 600 }, children: `${symbolOf(currency?.currency)} ${fmt(total)}` })
								]
							}),
							currency?.grantedBalance !== void 0 && react_jsx_runtime.jsxs("div", {
								style: { display: "flex", justifyContent: "space-between", gap: 16, padding: "2px 0" },
								children: [
									react_jsx_runtime.jsx("span", { style: dim, children: t("granted") }),
									react_jsx_runtime.jsx("span", { children: fmt(currency.grantedBalance) })
								]
							}),
							currency?.toppedUpBalance !== void 0 && react_jsx_runtime.jsxs("div", {
								style: { display: "flex", justifyContent: "space-between", gap: 16, padding: "2px 0" },
								children: [
									react_jsx_runtime.jsx("span", { style: dim, children: t("toppedUp") }),
									react_jsx_runtime.jsx("span", { children: fmt(currency.toppedUpBalance) })
								]
							}),
							react_jsx_runtime.jsxs("div", {
								style: { display: "flex", justifyContent: "space-between", gap: 16, padding: "2px 0" },
								children: [
									react_jsx_runtime.jsx("span", { style: dim, children: t("available") }),
									react_jsx_runtime.jsx("span", {
										style: state.data?.isAvailable ? { color: "#3fb950" } : { color: "#f85149" },
										children: state.data?.isAvailable ? t("available") : t("unavailable")
									})
								]
							}),
							state.data?.fetchedAt !== void 0 && react_jsx_runtime.jsxs("div", {
								style: { display: "flex", justifyContent: "space-between", gap: 16, paddingTop: 4, fontSize: 11, ...dim },
								children: [
									react_jsx_runtime.jsx("span", { children: t("lastUpdate") }),
									react_jsx_runtime.jsx("span", { children: new Date(state.data.fetchedAt).toLocaleTimeString() })
								]
							}),
							react_jsx_runtime.jsx("button", {
								onClick: load,
								style: {
									marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4,
									background: "transparent", border: "none", padding: 0, cursor: "pointer",
									color: "var(--dsh-accent, #4d6bfe)", fontSize: 12
								},
								children: react_jsx_runtime.jsxs("span", {
									style: { display: "inline-flex", alignItems: "center", gap: 4 },
									children: [
										react_jsx_runtime.jsx(_primitives.IconRefreshOutline16, { size: 12 }),
										react_jsx_runtime.jsx("span", { children: t("refresh") })
									]
								})
							})
						]
					}),
					react_jsx_runtime.jsxs("button", {
						onClick: () => setOpen((v) => !v),
						title: t("label"),
						style: {
							display: "inline-flex", alignItems: "center", gap: 4,
							padding: "3px 8px", borderRadius: 6, fontSize: 12, whiteSpace: "nowrap",
							border: "none", cursor: "pointer", userSelect: "none",
							color: "var(--dsh-text-2, #c9d1d9)",
							background: state.status === "error"
								? "rgba(220,80,80,.14)"
								: state.status === "refreshing"
									? "rgba(77,107,254,.10)"
									: "transparent"
						},
						children: [
							react_jsx_runtime.jsx("span", { style: { color: "#4d6bfe", fontWeight: 700 }, children: "¥" }),
							react_jsx_runtime.jsx("span", { children: pillText })
						]
					})
				]
			});
		}
		/** Contribute the sidebar footer balance pill. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-balance: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-balance",
				order: 90,
				label: () => t("label"),
				locale: NS,
				inject: () => ({
					t,
					getBalance: async () => {
						const res = await fetch("/dsh-balance", { cache: "no-store" });
						return res.json();
					}
				})
			}, BalanceFooterAction));
		}
		//#endregion
		const inject = ["slots", "locale"];
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
