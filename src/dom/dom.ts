import * as Constants from "../core/constants";
import { TreeStep } from "./types";
import { Wire } from "../core/state";
import * as DOMConstants from "./constants";
const createTextNode = (arg: string | number | boolean | null | undefined) =>
  arg ? document.createTextNode(arg + "") : undefined;

const createMarker = (text: string, owner: DocumentFragment) => {
  const marker = document.createComment(text);
  (marker as any).__owner__ = owner;
  return marker;
};

export class LiveDocumentFragment extends DocumentFragment {
  startMarker: Comment;
  endMarker: Comment;
  constructor(t?: string) {
    super();
    this.startMarker = createMarker(`<${t}>`, this);
    this.endMarker = createMarker(`</${t}>`, this);
    super.append(this.startMarker, this.endMarker);
  }
  append(...nodes: Node[]) {
    this.endMarker.before(...nodes);
  }
  prepend(...nodes: Node[]) {
    this.startMarker.after(...nodes);
  }
}

export const createDOMNode = (
  step: TreeStep,
  isSvg?: boolean
): Node | LiveDocumentFragment | undefined => {
  if (!step || !step.node) return;

  // primitive types
  if (step.type === DOMConstants.PrimitiveTreeStep) {
    return createTextNode(step.node);
  }

  // wire: create text node from wire output
  if (step.type == DOMConstants.WireTreeStep) {
    const wire = step.node as Wire;
    const value = wire();
    let childEL: Node | undefined = undefined;
    if (
      ["string", "number", "boolean", "undefined"].indexOf(typeof value) > -1
    ) {
      childEL = createTextNode(wire() + "");
      wire.tasks.add((val: any) => {
        childEL ? (childEL.textContent = val) : null;
      });
    }
    return childEL;
  }

  if (step.node && typeof step.node === "object") {
    const props: Record<string, any> =
      step.node.type === DOMConstants.COMPONENT ||
      step.node.type === DOMConstants.NATIVE
        ? step?.node?.p
        : {};

    // function component
    if (step.node.type === DOMConstants.COMPONENT) {
      return new LiveDocumentFragment(step.node.t.__name__);
    }

    // plain DOM node
    if (step.node.type === DOMConstants.NATIVE) {
      const { t } = step.node;
      const el = isSvg
        ? document.createElementNS("http://www.w3.org/2000/svg", t)
        : document.createElement(step.node.t);
      const { children, ...rest } = props;

      for (const key in rest) {
        // onClick to onclick
        // TODO: handle it better?

        const value = rest[key];

        const isFunctionHandler = key[0] == "o" && key[1] == "n";
        const finalKey: string = isFunctionHandler ? key.toLowerCase() : key;
        if (key === "dangerouslySetInnerHTML") {
          el.innerHTML = value.__html;
        } else if (key == "ref" && typeof value === "function") {
          (value as any)(el);
        } else if (isFunctionHandler) {
          // set function on el
          (el as any)[finalKey] = value;
        } else {
          if (value && value.type === Constants.WIRE) {
            const w: Wire<string> = value;
            const val = w();
            setAttributeValue(el, finalKey, val);
            w.tasks.add((val) => {
              setAttributeValue(el, finalKey, val);
            });
          } else {
            setAttributeValue(el, finalKey, value);
          }
        }
      }

      return el;
    }
  }
};

const setAttributeValue = (
  el: HTMLElement | SVGElement,
  attr: string,
  val: any
) => {
  try {
    if (val === undefined) {
      (el as HTMLElement).removeAttribute(attr);
    } else {
      (el as HTMLElement).setAttribute(attr, val);
    }
  } catch (e) {
    console.error(el, attr, val);
    throw e;
  }
};
