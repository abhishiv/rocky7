import {
  VElement,
  ComponentVElement,
  NativeVElement,
  NativeTreeStep,
  PrimitiveTreeStep,
  WireTreeStep,
  TreeStep,
  RenderContext,
  ComponentTreeStep,
} from "./types";
import * as DOMConstants from "./constants";
import { createError, getVirtualElementId, checkIfSVG } from "./utils";
import { createDOMNode } from "./dom";
import { resolveComponent } from "./resolver";

import * as Constants from "../core/constants";
import { crawl } from "../utils/crawl";

export const reifyTree = (
  renderContext: RenderContext,
  el: VElement,
  parent?: TreeStep,
  afterIndex?: number
) => {
  const root = getTreeStep(
    parent,
    undefined,
    el,
    Number.isFinite(afterIndex) ? (afterIndex as number) + 1 : 0
  ) as TreeStep;
  const registry: TreeStep[] = [];

  // traverse bottom-up(post-order) and assemble dom tree
  crawl(
    root,
    function (step) {
      registry.push(step);
      // step.parent.children.push shouldnt be done here for root.parent at least
      // reason more about it: maybe reifyTree shouldn't take parent as prop?
      if (step !== root && step.parent) step.parent.children.push(step);
      const isSVG = checkIfSVG(step);
      const dom = createDOMNode(step, isSVG);
      if (dom) {
        step.dom = dom as HTMLElement;
        const children = registry.filter((el) => el.parent === step);
        if (children.length > 0) {
          const kids = children
            .filter((el) => el.dom)
            .map((el: TreeStep) => el.dom as Node)
            .flat();
          if ((step as ComponentTreeStep).mount) {
            //console.log("s", step);
          }
          // this enables support for portals
          (
            (step as ComponentTreeStep).mount || (dom as unknown as Element)
          ).append(...kids);
          if (step.type == DOMConstants.ComponentTreeStep) {
            if (step.onMount) step.onMount.forEach((el) => el());
          }
        }
      }
    },
    {
      order: "post",
      kids: getChildrenFromStep.bind(null, renderContext),
    }
  );
  return { registry, root };
};

const getComponentChildrenFromStep = (
  renderContext: RenderContext,
  parentStep: ComponentTreeStep
): TreeStep[] => {
  const el = resolveComponent(renderContext, parentStep);
  const r = (Array.isArray(el) ? el : [el])
    .map((item, i) => getTreeStep(parentStep, undefined, item, i) as TreeStep)
    .flat();
  return r;
};

const getPlainNodeChildrenFromStep = (
  renderContext: RenderContext,
  parentStep: NativeTreeStep
): TreeStep[] => {
  const { node, parent } = parentStep;
  return node
    ? (((node as NativeVElement)?.p?.children || []) as NativeVElement[])
        .map(
          (item, i) => getTreeStep(parentStep, undefined, item, i) as TreeStep
        )
        .flat()
    : [];
};

const getChildrenFromStep = (
  renderContext: RenderContext,
  parentStep: TreeStep
): TreeStep[] => {
  if (!parentStep) return [];
  const { node, parent } = parentStep;

  if (node && typeof node === "object") {
    if (Array.isArray(node)) {
      // todo fix this
      return [];
    }
    if (node.type === DOMConstants.NATIVE) {
      // todo: figure how to remove this typecast
      return getPlainNodeChildrenFromStep(renderContext, parentStep as any);
    }
    if (node.type == DOMConstants.COMPONENT) {
      // todo: figure how to remove this typecast
      return getComponentChildrenFromStep(renderContext, parentStep as any);
    }
  }
  return [];
};

export const getTreeStep = (
  parentStep: TreeStep | undefined,
  meta: Record<string, any> | undefined,
  el: VElement,
  index?: number
): TreeStep | TreeStep[] => {
  if (Array.isArray(el)) {
    return (el as VElement[]).map(
      (el, i) => getTreeStep(parentStep, undefined, el, i) as TreeStep
    );
  } else {
    const step: Partial<TreeStep> = {
      id: getVirtualElementId(el, index),
      node: el,
      meta,
      parent: parentStep,
      children: [],
    };
    if (
      el === null ||
      el === undefined ||
      typeof el == "string" ||
      typeof el === "number" ||
      typeof el === "boolean"
    ) {
      return {
        type: DOMConstants.PrimitiveTreeStep,
        ...step,
      } as PrimitiveTreeStep;
    } else if (el.type === DOMConstants.NATIVE) {
      return {
        type: DOMConstants.NativeTreeStep,
        ...step,
      } as NativeTreeStep;
      // why this not DOMConstants
    } else if (el.type === Constants.WIRE) {
      return {
        type: DOMConstants.WireTreeStep,
        ...step,
      } as WireTreeStep;
    } else if (el.type === DOMConstants.COMPONENT) {
      return {
        type: DOMConstants.ComponentTreeStep,
        ...step,
        state: { signals: {}, ctx: new WeakMap(), stores: {} },
        wires: [],
        onMount: [],
        onUnmount: [],
      } as ComponentTreeStep;
    } else {
      console.error(el);
      throw createError(110);
    }
  }
};
