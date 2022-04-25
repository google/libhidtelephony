/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/** Selected USB.org defined UsagePages IDs. */
export enum UsagePage {
  LED = 0x08,
  TELEPHONY = 0x0b,
}

/** Selected USB.org defined TelephonyUsage IDs. */
export enum TelephonyUsage {
  PHONE = 0x01,
  PROGRAMMABLE_BUTTON = 0x07,
  HOOK_SWITCH = 0x20,
  FLASH = 0x21,
  FEATURE = 0x22,
  REDIAL = 0x24,
  DROP = 0x26,
  PHONE_MUTE = 0x2f,
  ANSWER_ON_OFF = 0x74,
  LINE_BUSY_TONE = 0x97,
  RINGER = 0x9e,
}

/** Selected USB.org defined LedUsage IDs. */
export enum LedUsage {
  MUTE = 0x09,
  OFF_HOOK = 0x17,
  RING = 0x18,
  HOLD = 0x20,
  MICROPHONE = 0x21,
}
/**
 * Get the usage ID from usage field.
 * @param {number} usage
 * @return {number} usageId
 */
export function getUsageId(usage: number): number {
  return usage & 0xffff;
}

/**
 * Get the usage page ID from usage field.
 * @param {number} usage
 * @return {number} usagePage
 */
export function getUsagePage(usage: number): number {
  return usage >>> 16;
}

/**
 * Convert the usage page ID to string.
 * @param {number} usagePage
 * @return {string}
 */
function usagePageToString(usagePage: number): string {
  const str = UsagePage[usagePage] ?? 'UNKNOWN';
  return `${str}(0x${usagePage.toString(16).padStart(2, '0')})`;
}

/**
 * Cast usage field to human readable string. This only handle usages we care.
 * @param {number} usage
 * @return {string}
 */
export function usageToString(usage: number): string {
  const usagePage = getUsagePage(usage);
  const usageId = getUsageId(usage);
  let str: string;
  switch (usagePage) {
    case UsagePage.LED:
      str = LedUsage[usageId] ?? 'UNKNOWN';
      break;
    case UsagePage.TELEPHONY:
      str = TelephonyUsage[usageId] ?? 'UNKNOWN';
      break;
    default:
      str = 'UNKNOWN';
      break;
  }
  return `${usagePageToString(usagePage)}.${str}(0x${usageId
      .toString(16)
      .padStart(2, '0')})`;
}

export enum OnOffControlType {
  Undefined = 0,
  OnOffButtons,
  ToggleButton,
  ToggleSwitch,
}
/**
 * Get the type of the on/off control of the given report item.
 * @param {HIDReportItem} item
 * @return {OnOffControlType} type
 */
export function getOnOffControlType(item: HIDReportItem) : OnOffControlType {
  if (
    item.isAbsolute === undefined ||
    item.hasPreferredState === undefined ||
    item.logicalMinimum === undefined ||
    item.logicalMaximum === undefined
  ) {
    return OnOffControlType.Undefined;
  }
  if (
    !item.isAbsolute &&
    !item.hasPreferredState &&
    item.logicalMinimum === -1 &&
    item.logicalMaximum === 1
  ) {
    return OnOffControlType.OnOffButtons;
  }
  if (
    !item.isAbsolute &&
    item.hasPreferredState &&
    item.logicalMinimum === 0 &&
    item.logicalMaximum === 1
  ) {
    return OnOffControlType.ToggleButton;
  }
  if (
    item.isAbsolute &&
    !item.hasPreferredState &&
    item.logicalMinimum === 0 &&
    item.logicalMaximum === 1
  ) {
    return OnOffControlType.ToggleSwitch;
  }
  return OnOffControlType.Undefined;
}
