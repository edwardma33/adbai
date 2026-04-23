import type { NextApiRequest, NextApiResponse } from "next";

import { getPersistedTextareaDocument } from "@/lib/textarea-store.js";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<string>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).send("Method not allowed");
    return;
  }

  const document = getPersistedTextareaDocument();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send(document.content);
}
