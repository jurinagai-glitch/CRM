/**
 * Which industries this team develops itself, and which are a partner's
 * exclusive territory.
 *
 * This is business policy, not a data-derived fact: 美容室 and マンガ喫茶 are
 * developed exclusively by 春うららかな書房, so an inbound inquiry in those
 * industries is referred rather than pitched. It matters for the knowledge
 * layer because what a new person needs to know there is "refer it, and to
 * whom" — not how to pitch. Writing a pitch playbook for them would be wrong.
 *
 * Kept as a constant rather than a table because it is two rows that change
 * rarely; promote it to a table when a second partner gets a territory or the
 * grant needs an end date.
 */
export type ExclusiveTerritory = { businessType: string; partner: string; note: string };

export const EXCLUSIVE_TERRITORIES: ExclusiveTerritory[] = [
  {
    businessType: "美容室",
    partner: "春うららかな書房",
    note: "独占開拓権を付与済み。自社では開拓せず、問い合わせは春うららかな書房へ紹介する。",
  },
  {
    businessType: "マンガ喫茶",
    partner: "春うららかな書房",
    note: "独占開拓権を付与済み。自社では開拓せず、問い合わせは春うららかな書房へ紹介する。",
  },
];

export function exclusiveTerritoryFor(businessType: string | null | undefined): ExclusiveTerritory | null {
  if (!businessType) return null;
  return EXCLUSIVE_TERRITORIES.find((t) => t.businessType === businessType) ?? null;
}
