/** @jsx h **/

import { h, component } from "../../dom";
import { ComponentTreeStep, VElement } from "../../dom/types";

export type PortalProps = {
  mount: HTMLElement;
  children: VElement;
};

export const Portal = component<PortalProps>(
  "Portal",
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
    //(parentStep as ComponentTreeStep).mount = props.mount;
    return props.children;
  }
);
