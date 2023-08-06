/** @jsx h **/

import { SubToken, StoreCursor } from "../../core/state";
import { h, component, Fragment } from "../../dom/index";
import { ComponentUtils, VElement } from "../../dom/types";
import { ParentWireContext } from "../../dom/index";
import { META_FLAG, ObjPathProxy } from "../../utils/observer";
import { TreeStep } from "../../dom/types";
import { getUtils, addNode, removeNode } from "../../dom/api";
import { reifyTree, getTreeStep } from "../../dom/traverser";
import { getProxyMeta, getProxyPath } from "../../utils/observer";
import { getValueUsingPath } from "../../utils/index";
import { Observable, Change } from "../../core/index";
import { Observer } from "@gullerya/object-observer";

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export const Each: <T extends Array<unknown>>(
  props: {
    cursor: StoreCursor<T>;
    renderItem: (item: StoreCursor<ArrayElement<T>>, index: number) => VElement;
  },
  utils: ComponentUtils
) => VElement = component(
  "Each",
  (
    props,
    {
      wire,
      setContext,
      signal,
      utils,
      step: parentStep,
      renderContext,
      onMount,
      onUnmount,
    }
  ) => {
    // todo: important memory leak
    const $rootWire = wire(($: SubToken) => {});
    setContext(ParentWireContext, signal("$wire", $rootWire));

    const cursor = props.cursor;
    const store = (cursor as any)[META_FLAG];
    const path: string[] = getProxyPath(cursor);

    const value: any[] = getValueUsingPath(store.value as any, path) as any[];

    const observor = function (changes: Change[]) {
      //console.debug("change", changes, path);
      changes.forEach((change) => {
        //        console.log("change", change);
        if (Array.isArray(value)) {
          const isInteresting =
            change.path.length === path.length + 1 &&
            change.path.slice(0, path.length).join("/") === path.join("/");

          if (!isInteresting) return;
          if (change.type === "insert") {
            const index = parseInt(change.path[change.path.length - 1]);
            const { treeStep, el } = renderArray(
              parentStep,
              props.renderItem,
              cursor,
              value,
              index
            );
            const previousChildren = [...parentStep.children];
            const { registry, root } = reifyTree(renderContext, el, parentStep);
            addNode(renderContext, parentStep, root);
          }
        } else {
          const isInteresting =
            change.path.length === path.length + 1 &&
            change.path.slice(0, path.length).join("/") === path.join("/");
          if (isInteresting) {
            if (change.type === "insert") {
              const index = change.path[change.path.length - 1];
              const { treeStep, el } = renderArray(
                parentStep,
                props.renderItem,
                cursor,
                value,
                index
              );
              const previousChildren = [...parentStep.children];
              const { registry, root } = reifyTree(
                renderContext,
                el,
                parentStep
              );
              addNode(renderContext, parentStep, root);
            }
            //            console.log("object", change, JSON.stringify(path));
          }
        }
      });
    };
    onMount(() => {
      Observable.observe(store.value as Observable, observor);
    });
    onUnmount(() => {
      Observable.unobserve(store.value as Observable, observor);
    });

    if (Array.isArray(value)) {
      // array
      return (
        <Fragment>
          {value.map((el, index) =>
            props.renderItem((cursor as any)[index], index)
          )}
        </Fragment>
      );
    } else {
      // object
      return (
        <Fragment>
          {Object.keys(value).map((el, index) =>
            props.renderItem((cursor as any)[el], el as any)
          )}
        </Fragment>
      );
    }
  }
);

const renderArray = (
  parentStep: TreeStep,
  renderItem: Function,
  cursor: any,
  list: any[],
  index: number | string
) => {
  const vEl = renderItem((cursor as any)[index], index);
  const treeStep = getTreeStep(parentStep, undefined, vEl);
  return { treeStep, el: vEl };
};
