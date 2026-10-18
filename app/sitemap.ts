import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/library", "/editor", "/builder", "/privacy"].map((p) => ({ url: `${site.url}${p}` }));
}
