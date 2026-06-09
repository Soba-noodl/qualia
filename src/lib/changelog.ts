import type { TranslationKey } from "@/utils/translations";

export type ChangelogReleaseLevel = "major" | "important";

export type ChangelogEntry = {
  dateKey: TranslationKey;
  versionKey: TranslationKey;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  itemKeys: [TranslationKey, TranslationKey, TranslationKey];
  releaseLevel?: ChangelogReleaseLevel;
};

export type ChangelogMonth = {
  id: string;
  labelKey: TranslationKey;
  entries: ChangelogEntry[];
};

export const CHANGELOG_MONTHS: ChangelogMonth[] = [
  {
    id: "may-2026",
    labelKey: "changelogMonthMay2026",
    entries: [
      {
        dateKey: "changelogDate20260526",
        versionKey: "changelogVersion20260526",
        titleKey: "changelogTitle20260526",
        bodyKey: "changelogBody20260526",
        itemKeys: ["changelogItem20260526A", "changelogItem20260526B", "changelogItem20260526C"],
        releaseLevel: "important",
      },
      {
        dateKey: "changelogDate20260524",
        versionKey: "changelogVersion20260524",
        titleKey: "changelogTitle20260524",
        bodyKey: "changelogBody20260524",
        itemKeys: ["changelogItem20260524A", "changelogItem20260524B", "changelogItem20260524C"],
        releaseLevel: "major",
      },
      {
        dateKey: "changelogDate20260515",
        versionKey: "changelogVersion20260515",
        titleKey: "changelogTitle20260515",
        bodyKey: "changelogBody20260515",
        itemKeys: ["changelogItem20260515A", "changelogItem20260515B", "changelogItem20260515C"],
      },
      {
        dateKey: "changelogDate20260511",
        versionKey: "changelogVersion20260511",
        titleKey: "changelogTitle20260511",
        bodyKey: "changelogBody20260511",
        itemKeys: ["changelogItem20260511A", "changelogItem20260511B", "changelogItem20260511C"],
        releaseLevel: "important",
      },
      {
        dateKey: "changelogDate20260509",
        versionKey: "changelogVersion20260509",
        titleKey: "changelogTitle20260509",
        bodyKey: "changelogBody20260509",
        itemKeys: ["changelogItem20260509A", "changelogItem20260509B", "changelogItem20260509C"],
        releaseLevel: "important",
      },
      {
        dateKey: "changelogDate20260508",
        versionKey: "changelogVersion20260508",
        titleKey: "changelogTitle20260508",
        bodyKey: "changelogBody20260508",
        itemKeys: ["changelogItem20260508A", "changelogItem20260508B", "changelogItem20260508C"],
        releaseLevel: "important",
      },
      {
        dateKey: "changelogDate20260507",
        versionKey: "changelogVersion20260507",
        titleKey: "changelogTitle20260507",
        bodyKey: "changelogBody20260507",
        itemKeys: ["changelogItem20260507A", "changelogItem20260507B", "changelogItem20260507C"],
        releaseLevel: "important",
      },
      {
        dateKey: "changelogDate20260506",
        versionKey: "changelogVersion20260506",
        titleKey: "changelogTitle20260506",
        bodyKey: "changelogBody20260506",
        itemKeys: ["changelogItem20260506A", "changelogItem20260506B", "changelogItem20260506C"],
        releaseLevel: "important",
      },
      {
        dateKey: "changelogDate20260505",
        versionKey: "changelogVersion20260505",
        titleKey: "changelogTitle20260505",
        bodyKey: "changelogBody20260505",
        itemKeys: ["changelogItem20260505A", "changelogItem20260505B", "changelogItem20260505C"],
        releaseLevel: "important",
      },
    ],
  },
  {
    id: "april-2026",
    labelKey: "changelogMonthApril2026",
    entries: [
      {
        dateKey: "changelogDate20260430",
        versionKey: "changelogVersion20260430",
        titleKey: "changelogTitle20260430",
        bodyKey: "changelogBody20260430",
        itemKeys: ["changelogItem20260430A", "changelogItem20260430B", "changelogItem20260430C"],
        releaseLevel: "major",
      },
      {
        dateKey: "changelogDate20260421",
        versionKey: "changelogVersion20260421",
        titleKey: "changelogTitle20260421",
        bodyKey: "changelogBody20260421",
        itemKeys: ["changelogItem20260421A", "changelogItem20260421B", "changelogItem20260421C"],
      },
      {
        dateKey: "changelogDate20260415",
        versionKey: "changelogVersion20260415",
        titleKey: "changelogTitle20260415",
        bodyKey: "changelogBody20260415",
        itemKeys: ["changelogItem20260415A", "changelogItem20260415B", "changelogItem20260415C"],
        releaseLevel: "major",
      },
      {
        dateKey: "changelogDate20260414",
        versionKey: "changelogVersion20260414",
        titleKey: "changelogTitle20260414",
        bodyKey: "changelogBody20260414",
        itemKeys: ["changelogItem20260414A", "changelogItem20260414B", "changelogItem20260414C"],
      },
      {
        dateKey: "changelogDate20260409",
        versionKey: "changelogVersion20260409",
        titleKey: "changelogTitle20260409",
        bodyKey: "changelogBody20260409",
        itemKeys: ["changelogItem20260409A", "changelogItem20260409B", "changelogItem20260409C"],
      },
      {
        dateKey: "changelogDate20260402",
        versionKey: "changelogVersion20260402",
        titleKey: "changelogTitle20260402",
        bodyKey: "changelogBody20260402",
        itemKeys: ["changelogItem20260402A", "changelogItem20260402B", "changelogItem20260402C"],
        releaseLevel: "major",
      },
    ],
  },
  {
    id: "march-2026",
    labelKey: "changelogMonthMarch2026",
    entries: [
      {
        dateKey: "changelogDate20260331",
        versionKey: "changelogVersion20260331",
        titleKey: "changelogTitle20260331",
        bodyKey: "changelogBody20260331",
        itemKeys: ["changelogItem20260331A", "changelogItem20260331B", "changelogItem20260331C"],
      },
      {
        dateKey: "changelogDate20260327",
        versionKey: "changelogVersion20260327",
        titleKey: "changelogTitle20260327",
        bodyKey: "changelogBody20260327",
        itemKeys: ["changelogItem20260327A", "changelogItem20260327B", "changelogItem20260327C"],
        releaseLevel: "major",
      },
      {
        dateKey: "changelogDate20260325",
        versionKey: "changelogVersion20260325",
        titleKey: "changelogTitle20260325",
        bodyKey: "changelogBody20260325",
        itemKeys: ["changelogItem20260325A", "changelogItem20260325B", "changelogItem20260325C"],
        releaseLevel: "important",
      },
      {
        dateKey: "changelogDate20260321",
        versionKey: "changelogVersion20260321",
        titleKey: "changelogTitle20260321",
        bodyKey: "changelogBody20260321",
        itemKeys: ["changelogItem20260321A", "changelogItem20260321B", "changelogItem20260321C"],
      },
      {
        dateKey: "changelogDate20260312",
        versionKey: "changelogVersion20260312",
        titleKey: "changelogTitle20260312",
        bodyKey: "changelogBody20260312",
        itemKeys: ["changelogItem20260312A", "changelogItem20260312B", "changelogItem20260312C"],
      },
      {
        dateKey: "changelogDate20260311",
        versionKey: "changelogVersion20260311",
        titleKey: "changelogTitle20260311",
        bodyKey: "changelogBody20260311",
        itemKeys: ["changelogItem20260311A", "changelogItem20260311B", "changelogItem20260311C"],
        releaseLevel: "important",
      },
    ],
  },
];

export function getLatestChangelogVersionKey(): TranslationKey {
  return CHANGELOG_MONTHS[0].entries[0].versionKey;
}

