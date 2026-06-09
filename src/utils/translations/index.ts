/**
 * Centralized translation system, English (en) is the source of truth.
 * Translations are split by domain; this index merges them for the app.
 */

import { common } from "./common";
import { dashboard } from "./dashboard";
import { project } from "./project";
import { upload } from "./upload";
import { score } from "./score";
import { audit } from "./audit";
import { auth } from "./auth";
import { personas } from "./personas";
import { uploadModal } from "./uploadModal";
import { landing } from "./landing";
import { analytics } from "./analytics";
import { figma } from "./figma";
import { flow } from "./flow";
import { contextImages } from "./contextImages";
import { constraints } from "./constraints";
import { presets } from "./presets";
import { manualUpload } from "./manualUpload";
import { cookie } from "./cookie";
import { footer } from "./footer";
import { privacy } from "./privacy";
import { additionalContext } from "./additionalContext";
import { setupFork } from "./setupFork";
import { integrations } from "./integrations";
import { settings } from "./settings";
import { mcpSetup } from "./mcpSetup";
import { pluginAuth } from "./pluginAuth";
import { about } from "./about";
import { terms } from "./terms";
import { security } from "./security";
import { plugin } from "./plugin";
import { contact } from "./contact";
import { useCases } from "./useCases";
import { teams } from "./teams";
import { organizations } from "./organizations";
import { faq } from "./faq";
import { changelog } from "./changelog";
import { showcase } from "./showcase";

const domains = [
  common,
  dashboard,
  project,
  upload,
  score,
  audit,
  auth,
  personas,
  uploadModal,
  landing,
  analytics,
  figma,
  flow,
  contextImages,
  constraints,
  presets,
  manualUpload,
  cookie,
  footer,
  privacy,
  additionalContext,
  setupFork,
  integrations,
  settings,
  mcpSetup,
  pluginAuth,
  about,
  terms,
  security,
  plugin,
  contact,
  useCases,
  teams,
  organizations,
  faq,
  changelog,
  showcase,
];

function mergeLang<T extends Record<string, string>>(lang: "en" | "it"): T {
  return Object.assign({}, ...domains.map((d) => d[lang])) as T;
}

export const translations = {
  en: mergeLang("en"),
  it: mergeLang("it"),
} as const;

export type TranslationKey = keyof typeof translations.en;
