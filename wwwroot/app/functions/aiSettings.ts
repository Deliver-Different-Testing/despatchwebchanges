/**
 * The pre-2026-09 Auto-mate flags.
 *
 * Auto-mate is now on by default with five category toggles, all owned by
 * `react/services/aiPreferenceStore.ts` and persisted per user on the server.
 * These keys survive only so that migration can read them: `getItem` tells
 * "never touched it" apart from "turned it off", which is what lets an explicit
 * opt-out be honoured rather than silently reversed.
 *
 * Nothing should read these to decide whether to show an AI feature — use
 * `useAiFeature(category)`.
 */

import {ContactID} from '../contants';

export const LEGACY_AI_ENABLED_KEY = `aiEnabled_${ContactID}`;
export const LEGACY_AI_AUTO_OPEN_KEY = `aiAutoOpen_${ContactID}`;
