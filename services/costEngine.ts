
import { Asset, ConsumableLog, Job, Expense, AppSettings, JobStatus } from '../types';

export interface MonthlyCostReport {
  month: string; // YYYY-MM
  revenue: number;
  costs: {
    labor: number;
    consumables_actual: number; // calculated from avg cost
    depreciation: number;
    overhead: number;
    total: number;
  };
  netProfit: number;
}

export const CostEngine = {
  // Module A: Calculate Weighted Average Cost per "Can"
  calculateUnitCosts: (logs: ConsumableLog[], defaultSettings: AppSettings['consumables']) => {
    // Citric Acid
    const citricLogs = logs.filter(l => l.type === 'citric');
    let citricTotalCost = 0;
    let citricTotalCans = 0;

    if (citricLogs.length > 0) {
      citricLogs.forEach(l => {
        citricTotalCost += l.totalCost;
        citricTotalCans += l.yieldEstimate;
      });
    }
    
    // Chemical
    const chemLogs = logs.filter(l => l.type === 'chemical');
    let chemTotalCost = 0;
    let chemTotalCans = 0;

    if (chemLogs.length > 0) {
      chemLogs.forEach(l => {
        chemTotalCost += l.totalCost;
        chemTotalCans += l.yieldEstimate;
      });
    }

    return {
      citric: citricTotalCans > 0 ? (citricTotalCost / citricTotalCans) : defaultSettings.citricCostPerCan,
      chemical: chemTotalCans > 0 ? (chemTotalCost / chemTotalCans) : (defaultSettings.chemicalDrumCost / defaultSettings.chemicalDrumToBottles),
      isUsingActual: citricLogs.length > 0 || chemLogs.length > 0
    };
  },

  // Module B: Calculate Depreciation for a specific month
  calculateDepreciation: (assets: Asset[], year: number, month: number): number => {
    const targetDate = new Date(year, month - 1, 1); // 1st of target month
    let totalDepreciation = 0;

    assets.forEach(asset => {
      if (asset.status === 'retired') return;
      
      const purchaseDate = new Date(asset.purchaseDate);
      const endDate = new Date(purchaseDate);
      endDate.setMonth(purchaseDate.getMonth() + asset.lifespanMonths);

      // Check if asset is active during target month
      // Logic: purchaseDate <= targetMonth < endDate
      if (targetDate >= purchaseDate && targetDate < endDate) {
        totalDepreciation += (asset.cost / asset.lifespanMonths);
      }
    });

    return totalDepreciation;
  },

  // Module E: Generate Full Report
  generateMonthlyReport: (
    year: number, 
    month: number, 
    jobs: Job[], 
    expenses: Expense[], 
    assets: Asset[], 
    stockLogs: ConsumableLog[],
    settings: AppSettings
  ): MonthlyCostReport => {
    const datePrefix = `${year}-${String(month).padStart(2, '0')}`;
    
    // 1. Revenue
    const monthlyJobs = jobs.filter(j => j.status === JobStatus.COMPLETED && j.serviceDate.startsWith(datePrefix));
    const revenue = monthlyJobs.reduce((sum, j) => sum + (j.financial?.total_amount || j.totalPaid || 0), 0);

    // 2. Labor (Module C)
    const labor = settings.monthlySalary; // Fixed monthly

    // 3. Consumables (Module A - Logic)
    // Use weighted average if stock logs exist, else use settings
    const unitCosts = CostEngine.calculateUnitCosts(stockLogs, settings.consumables);
    
    const consumables_actual = monthlyJobs.reduce((sum, j) => {
      const c = j.consumables?.citric_acid ?? j.citricAcidCans ?? 0;
      const chem = j.consumables?.chemical ?? j.otherChemicalCans ?? 0;
      return sum + (c * unitCosts.citric) + (chem * unitCosts.chemical);
    }, 0);

    // 4. Depreciation (Module B)
    const depreciation = CostEngine.calculateDepreciation(assets, year, month);

    // 5. Overhead (Module D)
    const overhead = expenses
      .filter(e => e.date.startsWith(datePrefix))
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      month: datePrefix,
      revenue,
      costs: {
        labor,
        consumables_actual,
        depreciation,
        overhead,
        total: labor + consumables_actual + depreciation + overhead
      },
      netProfit: revenue - (labor + consumables_actual + depreciation + overhead)
    };
  }
};
