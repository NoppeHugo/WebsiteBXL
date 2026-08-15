import type { APIRoute } from "astro";
import { iconSvg } from "../lib/icon.ts";

export const GET: APIRoute = () =>
  new Response(iconSvg(), {
    headers: { "content-type": "image/svg+xml" },
  });
