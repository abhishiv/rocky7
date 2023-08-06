/** @jsx h  **/
/** @jsxFrag Fragment */
import {
  component,
  h,
  render,
  When,
  Each,
  SubToken,
  Portal,
  Fragment,
  reify,
  produce,
} from "rocky7";

export const PortalExample = component("PortalExample", (props, utils) => {
  const $active = utils.signal("active", false);
  return (
    <div>
      <button
        onClick={(e) => {
          $active(!$active());
        }}
      >
        toggle modal
      </button>
      <When
        condition={($) => $active($)}
        views={{
          true: () => {
            return (
              <Portal mount={document.body}>
                <div style="position: fixed; max-width: 400px; max-height: 50vh; background: white; padding: 7px; width: 100%; border: 1px solid #000;top: 0;">
                  <h1>Portal</h1>
                </div>
              </Portal>
            );
          },
          false: () => {
            return "";
          },
        }}
      ></When>
    </div>
  );
});

export const Todos = component("Todos", (props, { signal, wire, store }) => {
  const $todos = store("todos", {
    items: [
      { task: "Do Something", stats: { count: 0 } },
      { task: "Do Something else", stats: { count: 1 } },
    ],
  });
  const b = $todos.items;

  return (
    <div>
      <h4>Todos</h4>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target as HTMLFormElement);
          const json = Object.fromEntries(formData) as {
            task: string;
            stats: any;
          };
          json.stats = { count: 0 };
          console.log(json);
          produce($todos.items, (items) => {
            items.push(json);
          });
          (e.target as HTMLFormElement).reset();
        }}
      >
        <input
          placeholder={"Enter todo and press ⏎"}
          name="task"
          type="text"
          required
          style="width: 100%; max-width: 400px;"
        />
      </form>
      <ul>
        <Each
          cursor={$todos.items}
          renderItem={(item, i) => {
            const v = reify(item);
            console.log(v.task, item.task);
            return (
              <li key={i}>
                <span style="padding: 0 4px 0 0 ;">
                  <button
                    onClick={(e) => {
                      produce(item.stats, (obj) => {
                        obj.count = obj.count + 1;
                      });
                    }}
                  >
                    {wire(($: SubToken) => $(item.stats.count))}
                  </button>
                </span>
                {wire(($: SubToken) => $(item.task))}
              </li>
            );
          }}
        ></Each>
      </ul>
    </div>
  );
});

const Test = component("Test", (props, utils) => {
  return <div key="1">hey</div>;
});

export const Layout = component<{}>(
  "Layout",
  (props, { signal, wire, api }) => {
    const $count = signal("count", 0);
    const $doubleCount = wire(($) => $count($) * 2); // explicit subscription

    //    setTimeout(() => {
    //      //$count(6);
    //      api.insert(["div"], <div key="3">text</div>, "div/1");
    //    }, 1000);
    //    setTimeout(() => {
    //      //$count(6);
    //      api.insert(["div"], <div key="4">text2</div>, "span");
    //    }, 2000);
    //    setTimeout(() => {
    //      //$count(6);
    //      //api.remove(["div"], "div/3");
    //    }, 4000);
    //    return (
    //      <div>
    //        <Test />
    //        <span>span</span>
    //        <div
    //          onClick={(e) => {
    //            e.preventDefault();
    //            $count($count() + 1);
    //          }}
    //          key="2"
    //        >
    //          {wire($count)}
    //        </div>
    //      </div>
    //    );
    //    return <Todos />;
    return (
      <div id="home">
        <div style="display: flex;">
          <h2 style="flex: 1;">
            Rocky7 Kitchen Sink <i class="las la-utensils"></i>
          </h2>
          <div>
            <h4>
              <a href="https://github.com/abhishiv/rocky7">
                <i class="lab la-github-alt"></i> docs
              </a>
            </h4>
          </div>
        </div>
        <section>
          <h3>Signal Example with &lt;When&gt; </h3>
          <p>
            <button
              onClick={() => {
                $count($count() - 1);
              }}
            >
              -
            </button>
            <span style="padding: 7px;">{wire($count)}</span>
            <button
              onClick={() => {
                $count($count() + 1);
              }}
            >
              +
            </button>
          </p>
          <p>
            <strong>Greater than 5:?</strong>
            <When
              condition={($) => $count($) > 5}
              views={{
                true: () => {
                  return <div key="true">"TRUE"</div>;
                },
                false: () => {
                  return <div key="false">"FALSE"</div>;
                },
              }}
            ></When>
          </p>
          <p>Double count = {$doubleCount}</p>
        </section>
        <hr />
        <section>
          <h3>Store Example with &lt;Each&gt; </h3>
          <div>
            <Todos />
          </div>
        </section>
        <hr />
        <section>
          <h3>Modal with &lt;Portal&gt; </h3>
          <div>
            <PortalExample />
          </div>
        </section>
        <hr />
        <section>
          <h3>SVG Example</h3>
          <div>
            <svg
              width="100px"
              viewBox="0 0 220 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect fill="indianred" width="100" height="100" />

              <rect
                fill="darkslategray"
                x="120"
                width="100"
                height="100"
                rx="15"
              />
            </svg>
          </div>
        </section>
      </div>
    );
  }
);
