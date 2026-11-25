export type ReviewReply = {
  id: string;
  actor: "client" | "photographer";
  text: string;
  createdAt: string;
};
export type ReviewActivityData = {
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  lastFeedbackAt: string | null;
  events: { id: string; kind: string; actor: string; createdAt: string }[];
};
export type ApprovalReceipt = {
  id: string;
  approvedAt: string;
  snapshot: {
    title: string;
    version: number;
    bookId: string;
    previewDigest: string;
    surfaces: number;
    watermark: boolean;
    unresolvedComments: number;
  };
};
