import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Study Buddy",
    short_name: "Study Buddy",
    description:
      "AI-powered study planner for tests, quizzes, assignments, and practice quizzes.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef2ff",
    theme_color: "#3b82f6",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    categories: ["education", "productivity"],
  };
}
