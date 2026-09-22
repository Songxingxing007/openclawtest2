import { definePage } from "@openclaw/uirouter";
import { html } from "lit";
import { routePageSpec } from "../../app-route-paths.ts";

export const page = definePage({
  ...routePageSpec("model-onboarding"),
  component: () =>
    import("./model-onboarding-page.ts").then(() => ({
      header: true,
      render: () => html`<openclaw-model-onboarding-page></openclaw-model-onboarding-page>`,
    })),
});
