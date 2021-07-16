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

/** Selected USB.org defineed UsagePages IDs. */
export enum UsagePage {
  LED = 0x08,
  BUTTON = 0x09,
  TELEPHONY = 0x0b,
  CONSUMER = 0x0c,
}

/** Selected USB.org defineed TelephonyUsage IDs. */
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

/** Selected USB.org defineed LedUsage IDs. */
export enum LedUsage {
  MUTE = 0x09,
  OFF_HOOK = 0x17,
  RING = 0x18,
  HOLD = 0x20,
  MICROPHONE = 0x21,
}

/** Get the usage id from usage field. */
export function getUsageId(usage: number) {
  return usage & 0xffff;
}

/** Get the usage page id from usage field. */
export function getUsagePage(usage: number) {
  return usage >>> 16;
}

function usagePageToString(usagePage: number) {
  let str = 'UNKNOWN';
  if (usagePage in UsagePage) {
    str = UsagePage[usagePage];
  }
  return `${str}(0x${usagePage.toString(16).padStart(2, '0')})`;
}

/**
 * Cast usage field to human readable string. This only handle usages we care.
 */
export function usageToString(usage: number) {
  const usagePage = getUsagePage(usage);
  const usageId = getUsageId(usage);
  let str = 'UNKNOWN';
  switch (usagePage) {
    case UsagePage.LED:
      if (usageId in LedUsage) {
        str = LedUsage[usageId];
      }
      break;
    case UsagePage.TELEPHONY:
      if (usageId in TelephonyUsage) {
        str = TelephonyUsage[usageId];
      }
      break;
    default:
      break;
  }
  return `${usagePageToString(usagePage)}.${str}(0x${usageId
    .toString(16)
    .padStart(2, '0')})`;
}
