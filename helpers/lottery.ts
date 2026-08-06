import { Lottery } from "../data/lottery";

function getWeeklySeed(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDays = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.floor(pastDays / 7);
}

function seededRandom(seed: string, max: number, min: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash % (max - min + 1)) + min;
}

export function addFakeTicketsToLottery(lottery: Lottery): Lottery {
  const percentSold =
    Number(lottery.participantsCount) / Number(lottery.maximumTickets);
  if (percentSold < 0.5) {
    const seed = `${getWeeklySeed()}${lottery.uniqueCode}`;
    const fakeTicketsToAdd = seededRandom(seed, 200, 50); // Consistently generates the same number for a week
    lottery.participantsCount = Number(lottery.participantsCount) + Number(fakeTicketsToAdd);
  }
  return lottery;
}
