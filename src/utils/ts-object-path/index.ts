export type ObjPathProxy<TRoot, T> = {
  [P in keyof T]: ObjPathProxy<TRoot, T[P]>;
};

export type ObjProxyArg<TRoot, T> =
  | ObjPathProxy<TRoot, T>
  | ((p: ObjPathProxy<TRoot, TRoot>) => ObjPathProxy<TRoot, T>);

export const PATH_FLAG = Symbol("Object path");

export function createProxy<T>(
  path: PropertyKey[] = [],
  base: any = {}
): ObjPathProxy<T, T> {
  const proxy = new Proxy(
    // added to ts-object-path
    { [PATH_FLAG]: path, ...base },
    {
      get(target, key) {
        // added to ts-object-path
        if (base[key]) {
          return base[key];
        }
        if (key === PATH_FLAG) {
          return target[PATH_FLAG];
        }
        if (typeof key === "string") {
          const intKey = parseInt(key, 10);
          if (key === intKey.toString()) {
            key = intKey as any;
          }
        }
        return createProxy([...(path || []), key], base);
      },
    }
  );
  return proxy as any as ObjPathProxy<T, T>;
}

export function getPath<TRoot, T>(proxy: ObjProxyArg<TRoot, T>): PropertyKey[] {
  if (typeof proxy === "function") {
    proxy = proxy(createProxy<TRoot>());
  }
  return (proxy as any)[PATH_FLAG];
}

export function isProxy<TRoot, T>(value: any): value is ObjPathProxy<TRoot, T> {
  return (
    value &&
    typeof value === "object" &&
    !!getPath<TRoot, T>(value as ObjPathProxy<TRoot, T>)
  );
}

export function get<TRoot, T>(
  object: TRoot,
  proxy: ObjProxyArg<TRoot, T>,
  defaultValue: T | null | undefined = undefined
) {
  return getPath(proxy).reduce(
    (o, key) => o && valueOrElseDefault(o[key], defaultValue),
    object as any
  ) as T;
}

export function set<TRoot, T>(
  object: TRoot,
  proxy: ObjProxyArg<TRoot, T>,
  value: T
): void {
  getPath(proxy).reduce((o: any, key, index, keys) => {
    if (index < keys.length - 1) {
      o[key] = o[key] || (typeof keys[index + 1] === "number" ? [] : {});
      return o[key];
    }
    o[key] = value;
  }, object);
}

export function valueOrElseDefault<T>(value: T, defaultValue: T): T {
  return value !== null && value !== undefined ? value : defaultValue;
}
