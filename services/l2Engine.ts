
import { Job, Expense, L2Asset, L2StockLog, L2LaborConfig, JobStatus } from '../types';

export interface L2JobAnalysis {
  job: Job;
  revenue: number;
  costs: {
    labor: number;
    consumables: number;
    depreciation: number;
    traffic: number;
    total: number;
  };
  realGrossMargin: number;
}

export const L2Engine = {
  // 1. Calculate Unit Costs from L2 Data
  getConsumableUnitCosts: (logs: L2StockLog[]) => {
    // Weighted Average Cost
    const calcType = (type: 'citric' | 'chemical') => {
      const typeLogs = logs.filter(l => l.itemType === type);
      if (typeLogs.length === 0) return type === 'citric' ? 50 : 150; // Fallbacks
      
      const totalCost = typeLogs.reduce((sum, l) => sum + l.totalCost, 0);
      const totalYield = typeLogs.reduce((sum, l) => sum + (l.quantity * l.yieldPerUnit), 0);
      return totalYield > 0 ? totalCost / totalYield : 0;
    };

    return {
      citricPerCan: calcType('citric'),
      chemicalPerCan: calcType('chemical')
    };
  },

  getMonthlyDepreciation: (assets: L2Asset[], date: Date) => {
    return assets.reduce((sum, asset) => {
      if (asset.status === 'retired') return sum;
      const start = new Date(asset.purchaseDate);
      const end = new Date(start);
      end.setMonth(start.getMonth() + asset.lifespanMonths);
      
      if (date >= start && date < end) {
        return sum + (asset.cost / asset.lifespanMonths);
      }
      return sum;
    }, 0);
  },

  getTrafficCostPerMinute: (expenses: Expense[], jobs: Job[], monthPrefix: string) => {
    // Filter fuel expenses for the month
    const fuelCost = expenses
      .filter(e => e.date.startsWith(monthPrefix) && e.category === 'fuel')
      .reduce((sum, e) => sum + e.amount, 0);
      
    // Filter jobs for the month
    const monthlyJobs = jobs.filter(j => j.status === JobStatus.COMPLETED && j.serviceDate.startsWith(monthPrefix));
    
    // Total travel minutes recorded
    const totalMinutes = monthlyJobs.reduce((sum, j) => sum + (j.travelMinutesCalculated || 0), 0);
    
    return totalMinutes > 0 ? fuelCost / totalMinutes : 5; // Fallback $5/min if no data
  },

  // 2. Main Analysis Function
  analyzeJob: (
    job: Job, 
    laborConfig: L2LaborConfig, 
    unitCosts: { citricPerCan: number, chemicalPerCan: number },
    monthlyDepreciation: number,
    trafficCostPerMin: number,
    totalMonthlyWorkHours: number
  ): L2JobAnalysis => {
    
    const revenue = job.financial?.total_amount || job.totalPaid || 0;
    
    // Cost A: Consumables
    const citric = job.consumables?.citric_acid ?? job.citricAcidCans ?? 0;
    const chemical = job.consumables?.chemical ?? job.otherChemicalCans ?? 0;
    const costConsumables = (citric * unitCosts.citricPerCan) + (chemical * unitCosts.chemicalPerCan);

    // Cost B: Traffic (Direct Allocation)
    const costTraffic = (job.travelMinutesCalculated || 0) * trafficCostPerMin;

    // Cost C: Labor (Allocated by Work Hours)
    // Formula: (Total Fixed Labor / Total Work Hours in Month) * Job Hours
    const totalFixedLabor = laborConfig.bossSalary + laborConfig.partnerSalary + laborConfig.insuranceCost;
    const hourlyLaborRate = totalMonthlyWorkHours > 0 ? totalFixedLabor / totalMonthlyWorkHours : 0;
    const costLabor = (job.workDurationHours || 2) * hourlyLaborRate;

    // Cost D: Depreciation (Allocated by Work Hours)
    const hourlyDepreciation = totalMonthlyWorkHours > 0 ? monthlyDepreciation / totalMonthlyWorkHours : 0;
    const costDepreciation = (job.workDurationHours || 2) * hourlyDepreciation;

    const totalCost = costConsumables + costTraffic + costLabor + costDepreciation;

    return {
      job,
      revenue,
      costs: {
        labor: costLabor,
        consumables: costConsumables,
        depreciation: costDepreciation,
        traffic: costTraffic,
        total: totalCost
      },
      realGrossMargin: revenue - totalCost
    };
  }
};
