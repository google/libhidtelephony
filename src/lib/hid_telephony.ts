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

interface OutputEventInfo {
  reportId: number;
  state: boolean;
  generator: OutputEventGenerator;
  setter: OutputEventDataSetter;
}

interface OutputEventData {
  reportId: number;
  data: Uint8Array;
}

interface OutputEventGenerator {
  (): OutputEventData;
}

interface OutputEventDataSetter {
  (val: boolean, data: Uint8Array): Uint8Array;
}

/**
 * A manager for managing single device supporting telephony usage through
 * WebHID.
 */
export class TelephonyDeviceManager {
  private logger: Logger;

  private inputEventInfos: Record<InputUsage, InputEventInfo | undefined>;
  private inputEventObserverCallbacks: Record<InputUsage, ObserverCallback[]>;

  private outputEventInfos: Record<OutputUsage, OutputEventInfo | undefined>;

  private constructor(readonly device: HIDDevice, verbose: Level) {
    this.logger = new Logger(verbose);
    this.logger.debug(device);
    this.inputEventInfos = INPUT_USAGES.reduce((record, usage) => {
      return {...record, [usage]: undefined};
    }, {} as Record<InputUsage, InputEventInfo | undefined>);

    this.inputEventObserverCallbacks = INPUT_USAGES.reduce((record, usage) => {
      return {...record, [usage]: []};
    }, {} as Record<InputUsage, ObserverCallback[]>);

    this.outputEventInfos = OUTPUT_USAGES.reduce((record, usage) => {
      return {...record, [usage]: undefined};
    }, {} as Record<OutputUsage, OutputEventInfo | undefined>);

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
  static async create(verbose: Level = Level.DEBUG) {
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
        this.outputEventInfos[usageId] = {
          reportId: report.reportId,
          state: false,
          generator: () => {
            const reportData = new Uint8Array(length / 8);
            return {reportId: report.reportId!, data: reportData};
          },
          setter: (val: boolean, data: Uint8Array) => {
            if (offset >= 0) {
              const byteIndex = Math.trunc(offset / 8);
              const bitPosition = offset % 8;
              data[byteIndex] |= (val ? 1 : 0) << bitPosition;
            }
            return data;
          },
        } as OutputEventInfo;
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
    return this.outputEventInfos[usage] !== undefined;
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

  setState(usage: OutputUsage, val: boolean) {
    if (!this.device.opened) {
      return;
    }

    const info = this.outputEventInfos[usage];

    if (info !== undefined) {
      info.state = val;
    }

    return;
  }

  getState(usage: OutputUsage): boolean | undefined {
    this.logger.debug(`this.device.opened ${this.device.opened}`);
    if (!this.device.opened) {
      return undefined;
    }

    this.logger.debug(`GetState ${this.outputEventInfos[usage]?.state}`);
    return this.outputEventInfos[usage]?.state;
  }

  /* Send output events to the device.  */
  send(usages: Map<OutputUsage, boolean>) {
    if (!this.device.opened) {
      return;
    }

    const outputReports: Array<OutputEventData> = [];
    for (const [usage, val] of usages) {
      this.logger.debug(`usage: ${usage}, val: ${val}`);
      const eventInfo = this.outputEventInfos[usage];
      if (eventInfo === undefined) {
        continue;
      }

      const existingReport = outputReports.find(
        report => report.reportId === eventInfo?.reportId
      );
      if (existingReport === undefined) {
        outputReports.push(eventInfo?.generator());
      }
      eventInfo.state = val;
    }

    outputReports.forEach(report => {
      OUTPUT_USAGES.forEach(usage => {
        const eventInfo = this.outputEventInfos[usage];
        if (
          eventInfo === undefined ||
          eventInfo.reportId !== report.reportId ||
          !eventInfo.state
        ) {
          return;
        }

        report.data = eventInfo.setter(eventInfo.state, report.data);
      });
      this.logger.debug(
        `Send report with reportId: ${report.reportId} data: ${report.data}`
      );
      this.device.sendReport(report.reportId, report.data);
    });
  }
}
