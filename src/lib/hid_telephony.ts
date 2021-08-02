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

import {
  UsagePage,
  LedUsage,
  TelephonyUsage,
  getUsageId,
  getUsagePage,
  usageToString,
  OnOffControlType,
  getOnOffControlType,
} from './hid';
import {Level, Logger} from './logger';

const TELEPHONY_DEVICE_FILTERS: HIDDeviceFilter = {
  usagePage: UsagePage.TELEPHONY,
};

/** Following signals are sent from the device to the host. */
const INPUT_USAGES = [
  TelephonyUsage.HOOK_SWITCH,
  TelephonyUsage.PHONE_MUTE,
] as const;

/** Input usages covered by the library. */
export type InputUsage = typeof INPUT_USAGES[number];
const isTelephonyInputUsage = (x: number): x is InputUsage =>
  INPUT_USAGES.includes(x);

interface InputEventInfo {
  reportId: number;
  offset: number;
  controlType: OnOffControlType;
}

/** Interface of input event callback. */
export interface ObserverCallback {
  (val: boolean, controlType: OnOffControlType): void;
}

/** Following signals are sent from the host to the device. */
const OUTPUT_USAGES = [
  LedUsage.OFF_HOOK,
  LedUsage.RING,
  LedUsage.MUTE,
  TelephonyUsage.RINGER,
  // LedUsage.HOLD,
  // LedUsage.MICROPHONE,
] as const;

/** Output usages covered by the library. */
export type OutputUsage = typeof OUTPUT_USAGES[number];
const isTelephonyOutputUsage = (x: number): x is OutputUsage =>
  OUTPUT_USAGES.includes(x);

interface OutputEventData {
  reportId: number;
  data: Uint8Array;
}

interface OutputEventGenerator {
  (val: boolean): OutputEventData;
}

/**
 * A manager for managing single device supporting telephony usage through
 * WebHID.
 */
export class TelephonyDeviceManager {
  private logger: Logger;

  private inputEventInfos: Record<InputUsage, InputEventInfo | undefined>;
  private inputEventObserverCallbacks: Record<InputUsage, ObserverCallback[]>;

  private outputEventGenerators: Record<
    OutputUsage,
    OutputEventGenerator | undefined
  >;

  private constructor(readonly device: HIDDevice, verbose: Level) {
    this.logger = new Logger(verbose);
    this.logger.debug(device);
    this.inputEventInfos = INPUT_USAGES.reduce((record, usage) => {
      return {...record, [usage]: undefined};
    }, {} as Record<InputUsage, InputEventInfo | undefined>);

    this.inputEventObserverCallbacks = INPUT_USAGES.reduce((record, usage) => {
      return {...record, [usage]: []};
    }, {} as Record<InputUsage, ObserverCallback[]>);

    this.outputEventGenerators = OUTPUT_USAGES.reduce((templates, usage) => {
      return {...templates, [usage]: undefined};
    }, {} as Record<OutputUsage, OutputEventGenerator | undefined>);

    this.parseDeviceDescriptors();
    this.open();

    this.device.addEventListener('inputreport', e =>
      this.onInputReport(e as HIDInputReportEvent)
    );
  }

  /**
   * Create a TelephonyDeviceManager instance for a selected telephony device.
   * Returns null if none is selected.
   */
  static async create(verbose: Level = Level.INFO) {
    const hid = window.navigator.hid;
    const hidDevices = await hid.requestDevice({
      filters: [TELEPHONY_DEVICE_FILTERS],
    });
    if (hidDevices.length === 0) return null;
    return new TelephonyDeviceManager(hidDevices[0], verbose);
  }

  private onInputReport(event: HIDInputReportEvent) {
    this.logger.debug(
      `Receive an event with reportId ${
        event.reportId
      } and data: ${new Uint8Array(event.data.buffer)}`
    );
    for (const usage of INPUT_USAGES) {
      const eventInfo = this.inputEventInfos[usage];
      if (eventInfo === undefined || event.reportId !== eventInfo.reportId) {
        continue;
      }

      const byteIndex = Math.trunc(eventInfo.offset / 8);
      const bitPosition = eventInfo.offset % 8;
      const isSet =
        (event.data.getUint8(byteIndex) & (0x01 << bitPosition)) !== 0;
      for (const callback of this.inputEventObserverCallbacks[usage]) {
        callback(isSet, eventInfo.controlType);
      }
    }
  }

  async open() {
    if (!this.device.opened) {
      this.logger.info(`Open device :${this.device.productName}`);
      await this.device.open();
    }
  }

  async close() {
    if (!this.device.opened) {
      await this.device.close();
    }
  }

  /* Parse USB descriptors for reading/writing reports from/to the device. */
  private async parseDeviceDescriptors() {
    if (this.device.collections === undefined) {
      this.logger.error('Undefined device collection');
      throw new Error('Undefined device collection');
    }

    const telephonyCollection = this.device.collections.find(
      collection => collection.usagePage === UsagePage.TELEPHONY
    );

    if (telephonyCollection === undefined) {
      this.logger.error('No telephony collection');
      throw new Error('No telephony collection');
    }

    if (telephonyCollection.inputReports) {
      this.parseInputReport(telephonyCollection.inputReports);
    }
    if (telephonyCollection.outputReports) {
      this.parseOutputReport(telephonyCollection.outputReports);
    }
  }

  private parseInputReport(inputReports: HIDReportInfo[]) {
    for (const report of inputReports) {
      let offset = 0;
      if (report.items === undefined || report.reportId === undefined) {
        continue;
      }

      for (const item of report.items) {
        if (
          item.usages === undefined ||
          item.reportSize === undefined ||
          item.reportCount === undefined ||
          item.isAbsolute === undefined
        ) {
          continue;
        }

        for (const [i, usage] of item.usages.entries()) {
          if (getUsagePage(usage) === UsagePage.TELEPHONY) {
            const usageId = getUsageId(usage);
            if (isTelephonyInputUsage(usageId)) {
              this.inputEventInfos[usageId] = {
                reportId: report.reportId,
                offset: offset + i * item.reportSize,
                controlType: getOnOffControlType(item),
              } as InputEventInfo;
              this.logger.debug(
                `InputReport: ${usageToString(usage)} `,
                `reportId: ${report.reportId} `,
                `offset: ${offset + i * item.reportSize} `,
                `isAbsolute: ${item.isAbsolute}`
              );
            }
          }
        }
        offset += item.reportCount * item.reportSize;
      }
    }
  }

  private parseOutputReport(outputReports: HIDReportInfo[]) {
    for (const report of outputReports) {
      if (report.items === undefined || report.reportId === undefined) {
        continue;
      }

      let offset = 0;
      let outUsageOffsets: Array<[OutputUsage, number]> = [];

      for (const item of report.items) {
        if (
          item.usages === undefined ||
          item.reportSize === undefined ||
          item.reportCount === undefined
        ) {
          outUsageOffsets = [];
          break;
        }

        for (const [i, usage] of item.usages.entries()) {
          const usagePage = getUsagePage(usage);
          if (
            usagePage === UsagePage.TELEPHONY ||
            usagePage === UsagePage.LED
          ) {
            const usageId = getUsageId(usage) as OutputUsage;
            if (isTelephonyOutputUsage(usageId)) {
              outUsageOffsets.push([usageId, offset + i * item.reportSize]);
              this.logger.debug(
                `OutputReport: ${usageToString(usage)} reportId:${
                  report.reportId
                } offset: ${offset + i * item.reportSize}`
              );
            }
          }
        }
        offset += item.reportCount * item.reportSize;
      }

      const length = offset;
      for (const [usageId, offset] of outUsageOffsets) {
        this.outputEventGenerators[usageId] = (val: boolean) => {
          const reportData = new Uint8Array(length / 8);

          if (offset >= 0 && val) {
            const byteIndex = Math.trunc(offset / 8);
            const bitPosition = offset % 8;
            reportData[byteIndex] = 1 << bitPosition;
          }

          return {reportId: report.reportId!, data: reportData};
        };
      }
    }
  }

  getControlType(usage: InputUsage): OnOffControlType | undefined {
    if (this.supportInput(usage)) {
      return this.inputEventInfos[usage]?.controlType;
    }
    return undefined;
  }

  supportInput(usage: InputUsage): boolean {
    return this.inputEventInfos[usage] !== undefined;
  }

  supportOutput(usage: OutputUsage): boolean {
    return this.outputEventGenerators[usage] !== undefined;
  }

  subscribe(usage: InputUsage, callback: ObserverCallback) {
    this.inputEventObserverCallbacks[usage].push(callback);
  }

  /* Subscribe the Input event. */
  unsubscribe(usage: InputUsage, callback: ObserverCallback) {
    const callbackIndex =
      this.inputEventObserverCallbacks[usage].indexOf(callback);
    if (callbackIndex === -1) {
      this.logger.error('Nonexistent callback.');
      return;
    }
    this.inputEventObserverCallbacks[usage].splice(callbackIndex, 1);
  }
  /* Send a Ring event to the device. */
  sendRing(val: boolean) {
    if (!this.device.opened) {
      return;
    }
    const generator = this.outputEventGenerators[LedUsage.RING];
    if (generator !== undefined) {
      const report = generator(val);
      this.device.sendReport(report.reportId, report.data);
    }
  }

  /* Trigger event(s) with both off-hook and mute state to the device. */
  sendOffHookMute(offHook: boolean, mute: boolean) {
    if (!this.device.opened) {
      return;
    }
    const offHookGenerator = this.outputEventGenerators[LedUsage.OFF_HOOK];
    const muteGenerator = this.outputEventGenerators[LedUsage.MUTE];

    let report: OutputEventData | undefined;
    if (offHookGenerator !== undefined && muteGenerator !== undefined) {
      const offHookReport = offHookGenerator(offHook);
      const muteReport = muteGenerator(mute);
      if (offHookReport.reportId !== muteReport.reportId) {
        this.device.sendReport(offHookReport?.reportId, offHookReport.data);
        this.device.sendReport(muteReport?.reportId, muteReport.data);
        return;
      }

      report = {
        reportId: offHookReport.reportId,
        data: new Uint8Array(offHookReport.data),
      };
      for (const [i, data] of muteReport.data.entries()) {
        report.data[i] = muteReport.data[i] | data;
      }
    } else {
      report = offHookGenerator?.(offHook) ?? muteGenerator?.(mute);
    }

    if (report) {
      this.device.sendReport(report.reportId, report.data);
    }
  }

  /**
   * Send an output event to the device. This function only set single status
   * in the report and thus may override other status. Should be used only
   * for debugging or testing purpose.
   */
  send(usage: OutputUsage, val: boolean) {
    if (!this.device.opened) {
      return;
    }
    const generator = this.outputEventGenerators[usage];
    if (generator !== undefined) {
      const report = generator(val);
      this.device.sendReport(report.reportId, report.data);
    }
  }
}
