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
  getUsageId,
  getUsagePage,
  LedUsage,
  TelephonyUsage,
  UsagePage,
  usageToString,
} from './hid';
import {Level, Logger} from './logger';

const TELEPHONYDEVICEFILTERS: HIDDeviceFilter = {
  usagePage: UsagePage.TELEPHONY,
};

/** Following signals are sent from the headset to the host. */
const INPUT_USAGES = [
  TelephonyUsage.HOOK_SWITCH,
  TelephonyUsage.PHONE_MUTE,
  // TelephonyUsage.LINE_BUSY_TONE,
] as const;

/** Input usages covered by the library. */
export type InputUsage = typeof INPUT_USAGES[number];
const isTelephonyInputUsage = (x: number): x is InputUsage =>
  INPUT_USAGES.includes(x);

interface InputEventInfo {
  reportId: number;
  offset: number;
  isAbsolute: boolean;
  previousVal: boolean;
}

/** Interface of input event callback. */
export interface ObserverCallback {
  (val: boolean): void;
}

/** Following signals are sent from the host to the headset. */
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
      record[usage] = undefined;
      return record;
    }, {} as Record<InputUsage, InputEventInfo | undefined>);
    this.inputEventObserverCallbacks = INPUT_USAGES.reduce((record, usage) => {
      record[usage] = [];
      return record;
    }, {} as Record<InputUsage, ObserverCallback[]>);

    this.outputEventGenerators = OUTPUT_USAGES.reduce((templates, usage) => {
      templates[usage] = undefined;
      return templates;
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
      filters: [TELEPHONYDEVICEFILTERS],
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
    INPUT_USAGES.forEach(usage => {
      const eventInfo = this.inputEventInfos[usage];
      if (eventInfo === undefined || event.reportId !== eventInfo.reportId) {
        return;
      }

      const byteIndex = Math.trunc(eventInfo.offset / 8);
      const bitPosition = eventInfo.offset % 8;
      const isSet =
        (event.data.getUint8(byteIndex) & (0x01 << bitPosition)) !== 0;

      if (this.isInputToggle(usage)) {
        if (!eventInfo.previousVal && isSet) {
          this.inputEventObserverCallbacks[usage].forEach(callback =>
            callback(isSet)
          );
        }
        eventInfo.previousVal = isSet;
      } else {
        this.inputEventObserverCallbacks[usage].forEach(callback =>
          callback(isSet)
        );
      }
    });
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
                isAbsolute: item.isAbsolute,
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
      outUsageOffsets.forEach(([usageId, offset]) => {
        this.outputEventGenerators[usageId] = (val: boolean) => {
          const reportData = new Uint8Array(length / 8);

          if (offset >= 0 && val) {
            const byteIndex = Math.trunc(offset / 8);
            const bitPosition = offset % 8;
            reportData[byteIndex] = 1 << bitPosition;
          }

          return {reportId: report.reportId!, data: reportData};
        };
      });
    }
  }

  isInputToggle(usage: InputUsage): boolean | undefined {
    if (this.supportInput(usage)) {
      return !this.inputEventInfos[usage]?.isAbsolute;
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
    const callbackIndex = this.inputEventObserverCallbacks[usage].indexOf(
      callback
    );
    if (callbackIndex === -1) {
      this.logger.error('Nonexistent callback.');
      return;
    }
    this.inputEventObserverCallbacks[usage].splice(callbackIndex, 1);
  }

  /* Send an output event to the device. */
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
