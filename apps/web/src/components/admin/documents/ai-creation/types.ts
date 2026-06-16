export type AICreationStep = "prompt" | "generating" | "preview";

export type AIContextChips = {
  state: string;
  signers: string;
  category: string;
};

export type AIGeneratedIntelligence = {
  templateName: string;
  documentKey: string;
  description: string;
  signerRoles: string[];
  gateStep: string;
  documentBody: string;
};

export type AgentStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done";
};

export type ProxyTemplateRecord = {
  id: string;
  name: string;
  description: string;
  category: string;
  signerRoles: string[];
  gateStep: string;
  previewSnippet: string;
};
