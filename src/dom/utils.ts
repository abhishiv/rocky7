import * as Constants from "../core/constants";
import {
  BaseTreeStep,
  Context,
  Component,
  VElement,
  TreeStep,
  ComponentTreeStepState,
  NativeVElement,
  ComponentVElement,
  RenderContext,
} from "./types";
import { crawl } from "../utils/crawl";
import * as DOMConstants from "./constants";

export const getDescendants = (node: TreeStep): TreeStep[] => {
  const nodes: TreeStep[] = [];
  crawl(
    node,
    (node) => {
      nodes.push(node);
    },
    {
      kids: (parent) => {
        if (!parent.children) {
          console.log(parent);
        }
        return [...(Array.isArray(parent.children) ? parent.children : [])];
      },
      order: "post",
    }
  );
  return nodes;
};

// note: optimised to eagerly return using for for/while loops
// todo: use Array.some instead of for/while loops
export const getTreeStepRenderContextState = (
  renderContext: RenderContext,
  step: TreeStep
) => {
  const findMatchingResult = (
    previousState: Map<string[], ComponentTreeStepState>,
    baseTreeStep: TreeStep
  ): ComponentTreeStepState | undefined => {
    for (const key of previousState.keys()) {
      let currentStep: BaseTreeStep | undefined = baseTreeStep,
        index = 0,
        match = true;

      while (currentStep && index < key.length) {
        if (key[index] !== currentStep.id) {
          match = false;
          break;
        }
        currentStep = currentStep.parent;
        index++;
      }

      if (match && index === key.length && !currentStep) {
        return previousState.get(key);
      }
    }
  };

  const match = findMatchingResult(renderContext.prevState, step);
  return match;
};

export const getContextProvider = (
  ctxName: Context,
  node: TreeStep
): TreeStep | null => {
  let ancestor = node.parent;
  while (ancestor) {
    if (
      ancestor.type === DOMConstants.ComponentTreeStep &&
      ancestor.state.ctx &&
      ancestor.state.ctx.get(ctxName)
    ) {
      return ancestor;
    }
    ancestor = ancestor.parent;
  }
  return null;
};

export const checkIfSVG = (step: TreeStep) => {
  let isSVG = false;
  let iterNode = step;
  while (iterNode.parent) {
    if (
      iterNode.node &&
      typeof iterNode.node === "object" &&
      iterNode.node.type === DOMConstants.NATIVE
    ) {
      if (iterNode.node.t === "svg") {
        isSVG = true;
        break;
      }
    }
    iterNode = iterNode.parent;
  }
  return isSVG;
};

export const getVirtualElementId = (
  el: VElement,
  i?: number
): string | undefined => {
  const getElKey = (el: NativeVElement | ComponentVElement) =>
    el.p.key ? "/" + el.p.key : "";
  if (
    el === null ||
    el === undefined ||
    typeof el == "string" ||
    typeof el === "number" ||
    typeof el === "boolean"
  ) {
    return Number.isFinite(i) ? i + "" : undefined;
  } else if (el.type == DOMConstants.NATIVE) {
    return el.t + getElKey(el);
  } else if (el.type === DOMConstants.COMPONENT) {
    return (el.t as Component).__name__ + getElKey(el);
  } else {
    return i !== null && Number.isFinite(i) ? i + "" : undefined;
  }
};

export const arrayRemove = <T>(array: T[], ...items: T[]): void => {
  items.forEach((item) => {
    const index = array.indexOf(item);
    if (index !== -1) {
      array.splice(index, 1);
    }
  });
};

export function createError(code: string | number, desc?: string) {
  return new Error(
    `Error ${code}: https://github.com/abhishiv/rocky7/wiki/Error-codes#code-${code}`
  );
}
