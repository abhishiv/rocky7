import {
  ComponentUtils,
  VElement,
  RenderContext,
  ComponentTreeStep,
} from "./types";
import { getUtils } from "./api";

export const resolveComponent = (
  renderContext: RenderContext,
  parentStep: ComponentTreeStep
) => {
  const { node, parent } = parentStep;
  const utils: Omit<ComponentUtils, "utils"> = getUtils(
    renderContext,
    parentStep
  );
  const utilsCtx: ComponentUtils = { ...utils, utils: utils as ComponentUtils };
  const el = node.t.call(utilsCtx, node.p, utilsCtx) as VElement;
  return el;
};
