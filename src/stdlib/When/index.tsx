/** @jsx h **/

import { SubToken } from "../../core/state";
import { h, component } from "../../dom";
import { VElement } from "../../dom/types";
import { ParentWireContext } from "../../dom/index";
import { addNode, removeNode } from "../../dom/api";
import { reifyTree } from "../../dom/traverser";

export type WhenViews = { [key: string]: () => VElement };
export type WhenProps = {
  condition: ($: SubToken) => keyof WhenViews | boolean;
  views: WhenViews;
  fallback?: () => VElement;
  options?: { cached?: boolean };
  key?: string;
};

export const When = component<WhenProps>(
  "When",
  (
    props,
    {
      wire,
      setContext,
      signal,
      utils,
      onUnmount,
      onMount,
      step: parentStep,
      renderContext,
    }
  ) => {
    // todo: important memory leak
    const rootWire = wire(($: SubToken) => {});
    setContext(ParentWireContext, signal("$wire", rootWire));
    const underlying = utils.wire(props.condition);
    const value = underlying();
    const getView = (value: any) =>
      props.views[value as unknown as any] || props.fallback;
    const task = (value: any) => {
      const view = getView(value);
      const u = view ? view() : null;
      const previousChildren = [...parentStep.children];
      const { registry, root } = reifyTree(renderContext, u, parentStep);
      addNode(renderContext, parentStep, root);
      previousChildren.forEach((n) => removeNode(renderContext, n));
    };
    onMount(() => {
      underlying.tasks.add(task);
    });
    onUnmount(() => {
      underlying.tasks.delete(task);
    });
    const view = getView(value);
    return view ? view() : null;
  }
);
