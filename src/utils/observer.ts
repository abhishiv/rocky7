import {
  createProxy,
  getPath,
  ObjPathProxy,
  PATH_FLAG,
} from "./ts-object-path";

export { PATH_FLAG } from "./ts-object-path";
export type { ObjPathProxy } from "./ts-object-path";

export const CONTROL_FLAG = Symbol("CONTROL_FLAG");
export const META_FLAG = Symbol("META_FLAG");

export type StoreProxy<T = unknown, V = unknown> = ObjPathProxy<T, T>;

export type StoreProxyInternal<T = unknown, V = unknown> = StoreProxy<T, V> & {
  [PATH_FLAG]: string[];
  [META_FLAG]: V;
};
export const wrapWithProxy = <T = unknown, V = unknown>(
  obj: T,
  meta: any
): StoreProxy<T, V> => {
  const p = createProxy<T>([], {
    [META_FLAG]: meta,
    [CONTROL_FLAG]: (obj: any) => getPath(obj),
  });
  return p as StoreProxy<T, V>;
};
export const isProxy = (proxy: unknown) =>
  proxy && !!(proxy as StoreProxyInternal)[PATH_FLAG];

export const getProxyPath = (cursor: StoreProxy) => [
  ...(cursor as StoreProxyInternal)[PATH_FLAG],
];
export const getProxyMeta = <T = unknown>(cursor: StoreProxy) =>
  (cursor as StoreProxyInternal)[META_FLAG] as T;
