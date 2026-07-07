/**
 * Commission Rule Service
 * 
 * Handles commission calculation based on business rules:
 * - Rs. 500 if lead worth <= Rs. 25,000
 * - Rs. 1,000 if lead worth > Rs. 25,000
 * 
 * This service is designed to be extensible to support future rule changes
 * without modifying the lead confirmation logic.
 */

export interface CommissionRuleInput {
  leadWorth: number;
  employeeId: string;
  leadId: string;
}

export interface CommissionCalculationResult {
  commission: number;
  ruleApplied: string;
  leadWorth: number;
}

/**
 * Calculate commission based on lead worth
 * @param input Commission rule input containing lead worth
 * @returns Commission calculation result with amount and applied rule
 */
export const calculateCommission = (input: CommissionRuleInput): CommissionCalculationResult => {
  const { leadWorth, leadId, employeeId } = input;

  // Validate inputs
  if (typeof leadWorth !== 'number' || leadWorth < 0) {
    throw new Error(`Invalid leadWorth: ${leadWorth}. Must be a non-negative number.`);
  }

  if (!leadId || typeof leadId !== 'string') {
    throw new Error('leadId is required and must be a string');
  }

  if (!employeeId || typeof employeeId !== 'string') {
    throw new Error('employeeId is required and must be a string');
  }

  // Apply commission rules
  let commission = 0;
  let ruleApplied = '';

  if (leadWorth <= 25000) {
    commission = 500;
    ruleApplied = 'TIER_1_EQUAL_OR_BELOW_25K';
  } else {
    commission = 1000;
    ruleApplied = 'TIER_2_ABOVE_25K';
  }

  return {
    commission,
    ruleApplied,
    leadWorth
  };
};

/**
 * Calculate monthly incentive
 * 
 * Monthly incentive logic:
 * - If an employee's total confirmed sales for a month reach Rs. 1 Crore (10,000,000),
 *   they receive an additional Rs. 30,000 incentive.
 * 
 * @param totalConfirmedSalesAmount Total confirmed sales amount in a month
 * @returns Monthly incentive amount
 */
export const calculateMonthlyIncentive = (totalConfirmedSalesAmount: number): number => {
  if (typeof totalConfirmedSalesAmount !== 'number' || totalConfirmedSalesAmount < 0) {
    throw new Error(`Invalid totalConfirmedSalesAmount: ${totalConfirmedSalesAmount}. Must be a non-negative number.`);
  }

  const ONE_CRORE = 10_000_000;
  const INCENTIVE_AMOUNT = 30_000;

  return totalConfirmedSalesAmount >= ONE_CRORE ? INCENTIVE_AMOUNT : 0;
};

/**
 * Validate that commission calculation is correct
 * @param leadWorth Lead worth amount
 * @param expectedCommission Expected commission
 * @returns boolean indicating if commission is valid
 */
export const isValidCommission = (leadWorth: number, expectedCommission: number): boolean => {
  try {
    const result = calculateCommission({
      leadWorth,
      employeeId: 'temp',
      leadId: 'temp'
    });
    return result.commission === expectedCommission;
  } catch {
    return false;
  }
};

/**
 * Get commission rule description for logging/audit purposes
 * @param ruleApplied Rule identifier
 * @returns Human-readable rule description
 */
export const getRuleDescription = (ruleApplied: string): string => {
  const descriptions: Record<string, string> = {
    TIER_1_EQUAL_OR_BELOW_25K: 'Commission Tier 1: Lead worth <= Rs. 25,000 → Rs. 500',
    TIER_2_ABOVE_25K: 'Commission Tier 2: Lead worth > Rs. 25,000 → Rs. 1,000'
  };
  return descriptions[ruleApplied] || 'Unknown rule';
};
