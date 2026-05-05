// Mock data — replaced by Supabase queries in a later phase.
export type MockPet = {
  id: string;
  petName: string;
  ownerName: string;
  imageUrl: string;
  totalVotes: number;
  approvedAt: string;
  blurb?: string;
};

export const MOCK_PETS: MockPet[] = [
  {
    id: "p1",
    petName: "Biscuit",
    ownerName: "The Alvarez Family",
    imageUrl:
      "https://images.unsplash.com/photo-1561037404-61cd46aa615b?auto=format&fit=crop&w=900&q=80",
    totalVotes: 412,
    approvedAt: "2026-10-10",
    blurb: "Senior beagle mix. Snores like a small lawnmower.",
  },
  {
    id: "p2",
    petName: "Kimchi",
    ownerName: "Hana P.",
    imageUrl:
      "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?auto=format&fit=crop&w=900&q=80",
    totalVotes: 298,
    approvedAt: "2026-10-12",
    blurb: "Persian cat with strong opinions about cardboard boxes.",
  },
  {
    id: "p3",
    petName: "Mango",
    ownerName: "Devon W.",
    imageUrl:
      "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=900&q=80",
    totalVotes: 261,
    approvedAt: "2026-10-15",
    blurb: "Golden retriever. Honor student. Steals socks.",
  },
  {
    id: "p4",
    petName: "Pierogi",
    ownerName: "Sasha & Ben",
    imageUrl:
      "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80",
    totalVotes: 189,
    approvedAt: "2026-10-18",
    blurb: "Corgi with the soul of a small horse.",
  },
  {
    id: "p5",
    petName: "Olive",
    ownerName: "The Nguyen House",
    imageUrl:
      "https://images.unsplash.com/photo-1574144611937-0df059b5ef3e?auto=format&fit=crop&w=900&q=80",
    totalVotes: 154,
    approvedAt: "2026-10-21",
    blurb: "Tortie. Mayor of the upstairs hallway.",
  },
  {
    id: "p6",
    petName: "Rooster",
    ownerName: "The McKay Family",
    imageUrl:
      "https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=900&q=80",
    totalVotes: 97,
    approvedAt: "2026-10-25",
    blurb: "A very serious bulldog. Will watch you eat.",
  },
];

export const MOCK_CONTEST = {
  contestOpen: true,
  votingDeadline: "2026-11-13T23:59:00-07:00",
  submissionDeadline: "2026-11-13T23:59:00-07:00",
  goalAmountCents: 50000,
  raisedAmountCents: 31200,
};
