import { Observable, Change } from "@gullerya/object-observer";

import {
  wrapWithProxy,
  StoreProxy,
  isProxy,
  getProxyPath,
  getProxyMeta,
  ObjPathProxy,
} from "../../utils/observer";
import * as Constants from "../constants";
import { getValueUsingPath } from "../../utils/index";

export { getProxyMeta, getProxyPath } from "../../utils/observer";

export type Signal<T = unknown> = {
  id: string;
  (): T;
  /** Write value; notifying wires */
  // Ordered before ($):T for TS to work
  (value: T): void;
  /** Read value & subscribe */
  ($: SubToken): T;
  /** Wires subscribed to this signal */
  wires: Set<Wire<any>>;
  /** To check "if x is a signal" */
  type: typeof Constants.SIGNAL;

  value: T;
};

export type StoreCursor<T = unknown, V = StoreManager<T>> = StoreProxy<T, V>;
type extractGeneric<Type> = Type extends StoreCursor<infer X> ? X : never;

export type StoreManager<T = unknown> = {
  id: string;
  value: T;
  rootCursor: StoreCursor;
  /** Wires subscribed to this signal */
  wires: Set<Wire<any>>;
  type: typeof Constants.STORE;
};

/** 3 bits: [RUNNING][SKIP_RUN_QUEUE][NEEDS_RUN] */
type WireState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Wire<T = unknown> = {
  id: string;
  /** Run the wire */
  (): T;
  fn: WireFunction<T>; //| StoreCursor;
  /** Signals read-subscribed last run */
  sigRS: Set<Signal>;
  storesRS: WeakMap<StoreManager, Set<string>>;
  /** Post-run tasks */
  tasks: Set<(nextValue: T) => void>;
  /** Wire that created this wire (parent of this child) */
  upper: Wire | undefined;
  /** Wires created during this run (children of this parent) */
  lower: Set<Wire>;
  /** FSM state 3-bit bitmask: [RUNNING][SKIP_RUN_QUEUE][NEEDS_RUN] */
  /** Run count */
  run: number;
  value?: T;
  /** To check "if x is a wire" */
  type: typeof Constants.WIRE;
  token: SubToken;
  subWire: WireFactory;
  state: WireState;
};

export type SubToken = {
  /** Allow $(...signals) to return an array of read values */
  <T = unknown>(sig: Signal<T> | T): T;
  /** Wire to subscribe to */
  wire: Wire<any>;
  /** To check "if x is a subscription token" */
  type: typeof Constants.SUBTOKEN;
};

export type WireFunction<T = unknown> = {
  ($: SubToken, wire: WireFactory): T;
};

export type WireFactory<T = any> = (
  arg: WireFunction<T> | Signal<T> //| StoreCursor
) => Wire<T>;

// Symbol() doesn't gzip well. `[] as const` gzips best but isn't debuggable
// without a lookup Map<> and other hacks.
const S_RUNNING = 0b100;
const S_SKIP_RUN_QUEUE = 0b010;
const S_NEEDS_RUN = 0b001;

let SIGNAL_COUNTER = 0;
let WIRE_COUNTER = 0;
let STORE_COUNTER = 0;

export const wire: WireFactory = (arg) => {
  const w: Partial<Wire> = () => {
    const val = runWire(arg, $, subWireFactory);
    // Clean up unused nested wires
    return val;
  };
  const subWireFactory: WireFactory = (subFn) => {
    const subWire = wire(subFn);
    subWire.upper = w as Wire;
    (w as Wire).lower.add(subWire);
    return subWire;
  };
  const $: SubToken = getSubtoken(w as Wire);
  WIRE_COUNTER++;
  w.id = "wire|" + WIRE_COUNTER;
  w.sigRS = new Set();
  w.storesRS = new WeakMap();
  w.tasks = new Set();
  w.lower = new Set();
  w.run = 0;
  w.type = Constants.WIRE;
  w.fn = arg;
  w.token = $;
  w.subWire = subWireFactory;
  return w as Wire;
};

const runWire = (
  arg: WireFunction | Signal | StoreCursor,
  token: SubToken,
  subWireFactory: WireFactory
) => {
  if (isProxy(arg)) {
    const cursor = arg as StoreCursor;
    const v = token(cursor);
    token.wire.value = v;
    //console.log("vvv", value, cursor);
    //    debugger;
    return v;
  } else if ((arg as Signal).type === Constants.SIGNAL) {
    const sig = arg as Signal;
    const v = token(sig);
    token.wire.value = v;
    return v;
  } else {
    const fn = arg as WireFunction;
    const v = fn(token, subWireFactory);
    token.wire.value = v;
    return v;
  }
};

const wireReset = (wire: Wire<any>): void => {
  wire.lower.forEach(wireReset);
  wire.sigRS.forEach((signal) => signal.wires.delete(wire));
  _initWire(wire);
};

const _initWire = (wire: Wire<any>): void => {
  wire.state = S_NEEDS_RUN;
  wire.lower = new Set();
  // Drop all signals now that they have been unlinked
  wire.sigRS = new Set();
};

/**
 * Pauses a wire so signal writes won't cause runs. Affects nested wires */
const wirePause = (wire: Wire): void => {
  wire.lower.forEach(wirePause);
  wire.state |= S_SKIP_RUN_QUEUE;
};

/**
 * Resumes a paused wire. Affects nested wires but skips wires belonging to
 * computed-signals. Returns true if any runs were missed during the pause */
const wireResume = (wire: Wire): boolean => {
  wire.lower.forEach(wireResume);
  // Clears SKIP_RUN_QUEUE only if it's NOT a computed-signal
  // if (!wire.cs)
  wire.state &= ~S_SKIP_RUN_QUEUE;
  return !!(wire.state & S_NEEDS_RUN);
};

const _runWires = (wires: Set<Wire<any>>): void => {
  // Use a new Set() to avoid infinite loops caused by wires writing to signals
  // during their run.
  const toRun = new Set(wires);
  let curr: Wire<any> | undefined;
  // Mark upstream computeds as stale. Must be in an isolated for-loop
  toRun.forEach((wire) => {
    if (wire.state & S_SKIP_RUN_QUEUE) {
      toRun.delete(wire);
      wire.state |= S_NEEDS_RUN;
    }
    // TODO: Test (#3) + Benchmark with main branch
    // If a wire's ancestor will run it'll destroy its lower wires. It's more
    // efficient to not call them at all by deleting from the run list:
    curr = wire;
    while ((curr = curr.upper)) if (toRun.has(curr)) return toRun.delete(wire);
  });
  toRun.forEach((wire) => {
    const previousValue = wire.value;
    const val = runWire(wire.fn, wire.token, wire.subWire);
    //console.log("val", val, previousValue);
    wire.run = wire.run + 1;
    if (val === previousValue) return;
    //console.log("www", wire.value, previousValue, wire);
    //if (wire.value !== previousValue) {
    wire.value = val;
    for (const task of wire.tasks) {
      task(val);
    }
    //}
  });
};

export const signal = <T = any>(val: T): Signal<T> => {
  const s: Partial<Signal> = function (arg?: T) {
    const sig = s as Signal;
    if (arguments.length == 0) {
      return s.value;
    } else if (
      arg &&
      (arg as unknown as SubToken).type === Constants.SUBTOKEN
    ) {
      const token = arg as unknown as SubToken;
      // Two-way link. Signal writes will now call/update wire W
      token.wire.sigRS.add(sig);
      sig.wires.add(token.wire);
      return s.value;
    } else {
      s.value = arg;
      _runWires(sig.wires);
      return val;
    }
  };
  SIGNAL_COUNTER++;
  s.id = "signal|" + SIGNAL_COUNTER;
  s.value = val;
  s.wires = new Set<Wire>();
  s.type = Constants.SIGNAL;
  return s as Signal<T>;
};
// just to make api similar to haptic
signal.anon = signal;

export const store = <T = unknown>(obj: T): StoreCursor<T, StoreManager<T>> => {
  const storeManager: Partial<StoreManager<T>> = {
    wires: new Set<Wire>(),
    type: Constants.STORE,
  };
  const s = wrapWithProxy<T, StoreManager<T>>(obj, storeManager);

  const observedObject = Observable.from(obj);
  Observable.observe(observedObject, function (changes) {
    // console.log("changes", changes);
    const toRun = new Set<Wire>();
    // todo: improve this logic
    const manager = storeManager as StoreManager;
    for (const wire of manager.wires) {
      const cursors = wire.storesRS.get(manager);
      if (cursors) {
        for (var cursorStr of cursors) {
          const cursor = decodeCursor(cursorStr);
          //          console.log("cursor", cursor, cursorStr);
          const match = changes.some((el) => {
            //            console.log(
            //              encodeCursor(el.path.slice(0, cursor.length)),
            //              cursorStr
            //            );
            return encodeCursor(el.path.slice(0, cursor.length)) == cursorStr;
          });
          if (match) toRun.add(wire);
        }
      }
    }
    //console.log([...toRun]);
    _runWires(toRun);

    // patch == { op:"replace", path="/firstName", value:"Albert"}
  }) as T;
  storeManager.value = observedObject;
  STORE_COUNTER++;
  storeManager.id = "store|" + STORE_COUNTER;
  return s;
};

export const reify = <T = unknown>(cursor: T): extractGeneric<T> => {
  const s = cursor as unknown as StoreCursor;
  const manager: StoreManager = getProxyMeta<StoreManager>(s);
  const cursorPath = getProxyPath(s);
  //  console.log({ cursorPath, manager });
  //console.log(JSON.stringify(manager.value));
  const v = getValueUsingPath(manager.value as any, cursorPath);
  //console.log({ v, cursorPath });
  return v as extractGeneric<T>;
};

export const produce = <T = unknown>(
  cursor: T,
  setter: (obj: extractGeneric<T>) => void
): void => {
  const v = reify(cursor);
  setter(v);
};

const encodeCursor = (cursor: string[]) =>
  cursor.map(encodeURIComponent).join("/");
const decodeCursor = (str: string) => str.split("/").map(decodeURIComponent);

// todo: figure how to annotate values from store.cursor with Symbol
const getSubtoken = (wire: Wire): SubToken => {
  const token: Partial<SubToken> = (arg: Signal | StoreCursor) => {
    //console.log("arg", arg);
    if (isProxy(arg)) {
      const cursor = arg as StoreCursor;
      const cursorPath = getProxyPath(cursor);
      // todo: improve ts here and remove typecast
      const manager = getProxyMeta<StoreManager>(cursor);

      const encodedCursor = encodeCursor(cursorPath);

      manager.wires.add(wire);
      if (wire.storesRS.has(manager)) {
        wire.storesRS.get(manager)?.add(encodedCursor);
      } else {
        const set = new Set<string>();
        set.add(encodedCursor);
        wire.storesRS.set(manager, set);
      }
      const v = getValueUsingPath(manager.value as any, cursorPath);
      //console.log("v", v);
      wire.value = v;
      return v;
    } else {
      const sig = arg as Signal;
      const v = sig(token);
      wire.value = v;
      return v;
    }
  };
  token.wire = wire;
  token.type = Constants.SUBTOKEN;
  return token as SubToken;
};
