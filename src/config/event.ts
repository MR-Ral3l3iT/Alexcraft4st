export const EVENT_CONFIG = {
  capacity: 40,
  venueLat: null as number | null,
  venueLng: null as number | null,
  checkinRadiusM: 100,
  checkinStartAt: null as string | null,
  checkinEndAt: null as string | null,
  drinkCooldownSec: 600,
  drinkMaxPerUser: 10
} as const;
