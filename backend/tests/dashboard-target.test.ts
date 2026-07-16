import { calculateMonthlyTargetProgress } from '../src/controllers/dashboard-controller';

describe('monthly target helpers', () => {
  it('splits a target into equal segments', () => {
    const buildSegments = (target: number, count: number) => {
      const base = Math.floor(target / count);
      const remainder = target % count;
      return Array.from({ length: count }, (_, index) => ({
        label: `Segment ${index + 1}`,
        amount: base + (index < remainder ? 1 : 0)
      }));
    };

    expect(buildSegments(10, 4)).toEqual([
      { label: 'Segment 1', amount: 3 },
      { label: 'Segment 2', amount: 3 },
      { label: 'Segment 3', amount: 2 },
      { label: 'Segment 4', amount: 2 }
    ]);
  });

  it('calculates progress from confirmed lead worth against the fixed monthly target', () => {
    expect(calculateMonthlyTargetProgress(2_500_000)).toEqual({
      monthlyTarget: 5_000_000,
      monthlyTargetAchieved: 2_500_000,
      monthlyTargetProgress: 50,
      monthlyTargetRemaining: 2_500_000
    });
  });
});
