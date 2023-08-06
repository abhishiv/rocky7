import {
  VElement,
  TreeStep,
  RenderContext,
  ComponentTreeStep,
  ComponentUtils,
  EEmitter,
} from "./types";
import {
  getDescendants,
  getContextProvider,
  createError,
  getVirtualElementId,
  arrayRemove,
  getTreeStepRenderContextState,
} from "./utils";
import * as DOMConstants from "./constants";
import { reifyTree } from "./traverser";
import { Signal, signal, wire, store, StoreCursor } from "../core/state";
import { LiveDocumentFragment } from "./dom";

export const insertElement = (
  renderContext: RenderContext,
  parentStep: TreeStep,
  parentPath: string[],
  el: VElement,
  after?: string
) => {
  console.log("insert", parentPath, el, after);

  const step = parentPath.reduce<TreeStep | undefined>((step, key) => {
    if (!step) return;
    const child = step.children.find((el) => el.id === key);
    return child;
  }, parentStep);
  if (!step) throw new Error("");

  const afterIndex = after
    ? step.children.findIndex((el) => el.id === after)
    : undefined;

  const { root, registry } = reifyTree(renderContext, el, step, afterIndex);

  addNode(
    renderContext,
    step,
    root,
    afterIndex && afterIndex > -1
      ? step.children[afterIndex as number]
      : undefined
  );
};

export const removeElement = (
  renderContext: RenderContext,
  parentStep: TreeStep,
  parentPath: string[],
  key: string
) => {
  const step = parentPath.reduce<TreeStep | undefined>((step, key) => {
    if (!step) return;
    const child = step.children.find((el) => el.id === key);
    return child;
  }, parentStep);
  if (!step) throw createError(102);
  const child = step.children.find((el) => el.id === key);
  if (!child) throw createError(102);
  removeNode(renderContext, child);
};

export const updateElement = (
  renderContext: RenderContext,
  parentStep: TreeStep,
  key: string[],
  value: string
) => {
  // todo
};

export const addNode = (
  renderCtx: RenderContext,
  parentStep: TreeStep,
  node: TreeStep,
  after?: TreeStep
) => {
  // console.log("addNode", parentStep, node, after);
  const handle = (node: TreeStep) => {
    node.parent = parentStep;
    const nodes = getDescendants(node);
    //console.log("n", nodes, nodes.length);
    nodes.forEach((n) => renderCtx.reg.add(n));

    // dom
    const parentDOM = parentStep.dom;
    if (!node.dom) return;
    const elementsToInsert = node.dom;
    if (after) {
      const afterIndex = parentStep.children.indexOf(after);
      parentStep.children.splice(afterIndex, 0, node);

      const refNode: HTMLElement = after.dom as HTMLElement;
      refNode.after(elementsToInsert);
    } else {
      parentStep.children.push(node);
      if (parentDOM && (parentDOM as HTMLElement)) {
        parentDOM.append(elementsToInsert);
      }
    }
  };
  if (Array.isArray(node)) {
    node.forEach(handle);
  } else {
    handle(node);
  }
};

export const getLiveFragmentChildNodes = (frag: LiveDocumentFragment) => {
  const els: Node[] = [];
  let node: Node | null = frag.startMarker;
  while (node) {
    els.push(node);
    if (node === frag.endMarker) {
      break;
    }
    node = node.nextSibling;
  }
  return els;
};

export const rmNodes = (node: Node | LiveDocumentFragment) => {
  if (node instanceof LiveDocumentFragment) {
    const childNodes = getLiveFragmentChildNodes(node);
    childNodes.forEach((c) => c.parentNode?.removeChild(c));
  } else {
    node.parentElement?.removeChild(node);
  }
};

export const removeNode = (renderCtx: RenderContext, node: TreeStep) => {
  //console.log("removeNodes", nodes);
  const nodes = getDescendants(node);
  //  console.log("removeNode nodes", node, nodes);
  nodes.forEach((step) => {
    if (step.dom) {
      if (
        step.type === DOMConstants.ComponentTreeStep &&
        step.onUnmount.length > 0
      )
        step.onUnmount.forEach((el) => el());
      rmNodes(step.dom);
      step.dom = undefined;
    }
    renderCtx.reg.delete(step);
    step.parent ? arrayRemove(step.parent.children, step) : null;
  });
};

export const renderTreeStep = (renderCtx: RenderContext, element: VElement) => {
  const { root, registry } = reifyTree(renderCtx, element);
  const id = getVirtualElementId(root.node);
  if (!id) throw createError(101);

  // todo: move this to getRenderContext so it clears DOM properly
  renderCtx.el.innerHTML = "";

  registry.forEach((n) => renderCtx.reg.add(n));

  root.dom && renderCtx.el.append(root.dom);
};

export const getRenderContext = (container: HTMLElement, element: VElement) => {
  const id = getVirtualElementId(element);
  if (!id) throw createError(101);

  const renderContext: RenderContext =
    (container as any)[id] ||
    ({
      prevState: new Map(),
      el: container,
      id,
      reg: new Set(),
      emitter: new EEmitter(),
    } as RenderContext);

  renderContext.prevState.clear();

  renderContext.reg.forEach((step) => {
    if (
      step.type === DOMConstants.ComponentTreeStep &&
      step.onUnmount.length > 0
    )
      step.onUnmount.forEach((el) => el());

    if (step.type === DOMConstants.ComponentTreeStep) {
      const ids: string[] = [];
      let ancestor: TreeStep | undefined = step;
      while (ancestor) {
        // since primitive elements can't have children this is safe
        if (ancestor.id) {
          ids.push(ancestor.id);
        }
        ancestor = ancestor.parent;
      }
      renderContext.prevState.set(ids, step.state);
    }
  });

  renderContext.reg.clear();

  (container as any)[id] = renderContext;

  return renderContext;
};

export const getUtils = (
  renderContext: RenderContext,
  parentStep: ComponentTreeStep
): Omit<ComponentUtils, "utils"> => {
  return {
    step: parentStep,
    renderContext,
    signal(name: string, val) {
      const match = getTreeStepRenderContextState(renderContext, parentStep);

      // this enables state preservation during HMR
      const s =
        match && match.signals && match.signals[name]
          ? (match.signals[name] as Signal<any>)
          : (signal.anon(val) as Signal<any>);
      parentStep.state.signals[name] = s;
      return s;
    },
    wire(arg) {
      const w = wire(arg);
      parentStep.wires?.push(w);
      return w;
    },
    store(name: string, val) {
      const match = getTreeStepRenderContextState(renderContext, parentStep);

      // HMR
      const s =
        match && match.stores && match.stores[name]
          ? (match.stores[name] as StoreCursor)
          : (store(val) as StoreCursor);
      parentStep.state.stores[name] = s;
      return s as StoreCursor<any>;
    },
    setContext(ctx, value?) {
      parentStep.state.ctx.set(ctx, value || signal.anon(undefined));
    },
    getContext: (token) => {
      //console.time("ctx");
      const ancestor = parentStep && getContextProvider(token, parentStep);
      //console.timeEnd("ctx");
      if (ancestor && ancestor.type === DOMConstants.ComponentTreeStep) {
        return ancestor.state.ctx.get(token);
      } else {
        //console.error(token, parentStep);
        //throw createError(103, `${token.sym.toString()} not found`);
      }
    },
    onUnmount: (cb) => {
      (parentStep as ComponentTreeStep).onUnmount.push(cb);
    },
    onMount: (cb) => {
      (parentStep as ComponentTreeStep).onMount.push(cb);
    },
    api: {
      insert: insertElement.bind(null, renderContext, parentStep),
      remove: removeElement.bind(null, renderContext, parentStep),
      update: updateElement.bind(null, renderContext, parentStep),
    },
  };
};
