import * as DOMConstants from "../dom/constants";
import {
  Context,
  ComponentUtils,
  VElement,
  Component,
  ComponentVElement,
  NativeVElement,
} from "./types";
import { getRenderContext, renderTreeStep } from "./api";
import { reifyTree } from "./traverser";
import type {
  GenericEventAttrs,
  HTMLAttrs,
  SVGAttrs,
  HTMLElements,
  SVGElements,
} from "./jsx";
import { Wire } from "../core/state";

export * from "./types";
export {
  addNode,
  removeNode,
  insertElement,
  removeElement,
  updateElement,
} from "./api";
export { reifyTree } from "./traverser";

export function defineContext<T = any>(arg?: string): Context<T> {
  return {
    sym: Symbol(arg),
  };
}

export function component<T = any>(
  name: string,
  def: {
    (props: T, helpers: ComponentUtils): VElement;
  }
): Component<T> {
  (def as Component<T>).__name__ = name;
  return def as Component<T>;
}

function h(
  t: string | Component<any>,
  p?: any,
  ...children: VElement[]
): VElement {
  const props = {
    ...(p || {}),
    children: [...(children || [])].map((el) => el),
  };
  return {
    type: typeof t === "string" ? DOMConstants.NATIVE : DOMConstants.COMPONENT,
    p: props,
    t: t,
  } as ComponentVElement | NativeVElement;
}
export { h };

export function render(element: VElement, container: HTMLElement) {
  const renderContext = getRenderContext(container, element);
  //console.log("root", root, registry);
  renderTreeStep(renderContext, element);
  return renderContext;
}

// used to store parent wire in context
export const ParentWireContext = defineContext("ParentWireContext");

export const Fragment = component("Fragment", (props) => props.children);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DistributeWire<T> = T extends any ? Wire<T> : never;

export declare namespace h {
  export namespace JSX {
    export type MaybeWire<T> = T | DistributeWire<T>;
    export type AllowWireForProperties<T> = { [K in keyof T]: MaybeWire<T[K]> };

    export type Element = VElement;

    export interface ElementAttributesProperty {
      props: unknown;
    }
    export interface ElementChildrenAttribute {
      children: unknown;
    }

    // Prevent children on components that don't declare them
    export interface IntrinsicAttributes {
      children?: VElement[] | VElement;
      key?: string | number;
    }

    // Allow children on all DOM elements (not components, see above)
    // ESLint will error for children on void elements like <img/>
    export type DOMAttributes<Target extends EventTarget> =
      GenericEventAttrs<Target> & {};

    export type HTMLAttributes<Target extends EventTarget> =
      AllowWireForProperties<Omit<HTMLAttrs, "style">> & {
        style?: MaybeWire<string>;
      } & DOMAttributes<Target> &
        IntrinsicAttributes;

    export type SVGAttributes<Target extends EventTarget> =
      AllowWireForProperties<SVGAttrs> &
        HTMLAttributes<Target> &
        IntrinsicAttributes;

    export type IntrinsicElements = {
      [El in keyof HTMLElements]: HTMLAttributes<HTMLElements[El]>;
    } & { [El in keyof SVGElements]: SVGAttributes<SVGElements[El]> };
  }
}
