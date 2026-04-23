import type { NextApiRequest, NextApiResponse } from "next";

import {
  getPersistedTextareaDocument,
  saveTextareaDocument,
} from "@/lib/textarea-store.js";

type SuccessResponse = {
  content: string;
  updatedAt: number;
};

type ErrorResponse = {
  error: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (req.method === "GET") {
    const document = getPersistedTextareaDocument();
    res.status(200).json({
      content: document.content,
      updatedAt: document.updatedAt,
    });
    return;
  }

  if (req.method === "POST") {
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const document = saveTextareaDocument(content);

    res.status(200).json({
      content: document.content,
      updatedAt: document.updatedAt,
    });
    return;
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).json({ error: "Method not allowed" });
}
