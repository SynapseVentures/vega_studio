import { createFileRoute } from "@tanstack/react-router";
import { ChartBuilder } from "@/components/chart-builder/ChartBuilder";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vega-Lite Chart Builder" },
      {
        name: "description",
        content:
          "Build Vega-Lite charts visually: add data, pick layouts, tune colors and marks, and export the generated spec.",
      },
      { property: "og:title", content: "Vega-Lite Chart Builder" },
      {
        property: "og:description",
        content:
          "Compose Vega-Lite charts with a live preview and instantly copy the generated JSON spec.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ChartBuilder />;
}
