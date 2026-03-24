export type WafRuleAction = "block";

export type WafRule = {
  id: string;
  expression: string;
  action?: WafRuleAction;
};

export type WafSetRulesResult =
  | { success: true }
  | { success: false; error: string; rule_id?: string };

export type WafEvaluateResult =
  | { matched: false; error?: string }
  | { matched: true; rule_id: string; action: string };
