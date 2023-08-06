/** @jsx h **/

import { h, render } from "rocky7";

import { Layout } from "./index";

const renderApp = (props: { Layout: typeof Layout }) => {
  const { Layout } = props;
  const el = <Layout />;
  console.time("render");
  const renderContext = render(el, document.getElementById("app")!);
  console.timeEnd("render");
  console.log(renderContext);
};

window.addEventListener("load", () => renderApp({ Layout }));

if (import.meta.hot) {
  import.meta.hot.accept("./index", (newModule) => {
    if (newModule) renderApp(newModule as unknown as { Layout: typeof Layout });
  });
}
