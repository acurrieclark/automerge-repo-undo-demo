import qs from "qs";

export function getParams() {
  if (typeof location === "undefined") return {};
  return qs.parse(location.search, { ignoreQueryPrefix: true });
}

export function setParams(params: Record<string, string>) {
  const ps = qs.stringify(params);
  const url = location.pathname + "?" + ps;
  history.replaceState(history.state, document.title, url);
}
