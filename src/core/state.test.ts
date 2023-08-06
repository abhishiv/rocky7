import { assert, expect, test, describe, vi } from "vitest";
import { signal, wire, store, reify, produce } from "./state";

describe("Basic Implementation of Signals & Wires", (test) => {
  test("Signal", () => {
    const val = 1;
    const sig = signal(val);
    expect(sig).toBeDefined();
    expect(sig()).toBe(val);
  });

  test("Wire", () => {
    const sig = signal(2);
    const w = wire(($, wire) => {
      const val = $(sig);
      return val;
    });
    expect(w()).toBe(sig());
  });
});

describe("Nested Signals & Wires", (test) => {
  test("Nested Wires should cleanup and not fire multiple times in case of nested wires", () => {
    const c = { log: (...v: any[]) => console.log(...v) };
    const lSpy = vi.spyOn(c, "log");
    const sig = signal(1);
    const w = wire(($, wire) => {
      const val = $(sig);
      console.log("count", val);

      const b = wire(($, wire) => {
        const doubleCount = sig($) * 2;
        c.log("doublecount", doubleCount);
        return val;
      });
      b();
      return val;
    });
    w();
    sig(4);
    expect(lSpy.mock.calls.length).toBe(2);
  });
});

describe("Basic Implementation of Stores & Wires", (test) => {
  // test that wire only runs when subscribed cursors are updated
  test("Wire", () => {
    const c = { log: (...v: any[]) => console.log(...v) };
    const lSpy = vi.spyOn(c, "log");
    const val: { list: number[]; friends: { id: string; name: string }[] } = {
      list: [1, 2, 3],
      friends: [{ id: "2", name: "" }],
    };
    const s = store(val);

    const w = wire(($, wire) => {
      const v = $(s.friends[0].id);
      console.log(v);
      c.log(JSON.stringify(v));
      return v;
    });
    w();

    produce(s.friends, (obj) => {
      obj.push({ id: "2", name: "" });
    });
    produce(s.friends, (obj) => {
      obj[0].id = "33";
    });

    expect(lSpy.mock.calls.length).toBe(2);
  });
});
