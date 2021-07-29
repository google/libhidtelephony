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

import {LedUsage, TelephonyUsage} from '../lib/hid';
import {OutputUsage, TelephonyDeviceManager} from '../lib/hid_telephony';

function copyLog() {
  const logs = Array.from(document.getElementsByClassName('log-content'))
    .map(log => (log as HTMLSpanElement).innerText)
    .join('\n');
  if (logs) {
    navigator.clipboard.writeText(logs);
  }
}

function clearLog() {
  const log = document.getElementById('log')! as HTMLDivElement;
  log.innerHTML = '';
}

function appendLog(msg: string) {
  const log = document.getElementById('log')! as HTMLDivElement;
  const line = document.createElement('div');
  const date = document.createElement('span');
  const content = document.createElement('span');
  const dateTime = new Date();
  line.className = 'log-msg';
  date.className = 'log-date';
  content.className = 'log-content';
  date.innerText = `${new Intl.DateTimeFormat('default', {
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).format(dateTime)}  `;
  content.innerText = msg;
  line.appendChild(date);
  line.appendChild(content);
  log.appendChild(line);
  line.scrollIntoView();
}

function booleanToIcon(val: boolean | undefined): string {
  if (val === undefined) return '❓';
  return val ? '✅' : '❌';
}

function reset() {
  const outputCtrl = document.getElementById('output-controls')!;
  outputCtrl.hidden = true;
  outputCtrl.innerHTML = '<h4>Output Controls</h4>';

  const testCases = document.getElementById('test-cases')!;
  testCases.hidden = true;
  testCases.innerHTML = '<h4>Test Cases</h4>';
  clearLog();
}

const timeout = async (ms: number) => new Promise(res => setTimeout(res, ms));
let dialogValReady = false;

async function waitUserInput() {
  while (!dialogValReady) await timeout(100);
  dialogValReady = false;
}
const dialog = document.getElementById('dialog')!;
const yesBtn = document.getElementById('dialog-yes')!;
const yesCallback = () => {
  dialog.setAttribute('val', 'true');
  dialogValReady = true;
  dialog.hidden = true;
};
yesBtn.onclick = yesCallback;
const noBtn = document.getElementById('dialog-no')!;
const noCallback = () => {
  dialog.setAttribute('val', 'false');
  dialogValReady = true;
  dialog.hidden = true;
};
noBtn.onclick = noCallback;

async function confirmYesNo(msg: string, hideYes = false) {
  document.getElementById('dialog-msg')!.innerText = msg;
  yesBtn.hidden = hideYes;
  noBtn.hidden = false;
  dialog.hidden = false;
  await waitUserInput();
  return dialog.getAttribute('val') === 'true';
}

function verifyInputReport(deviceManager: TelephonyDeviceManager) {
  const inputReportTable = document.getElementById(
    'input-report'
  )! as HTMLTableElement;
  const hookSwitch = inputReportTable.rows[1];
  hookSwitch.cells[1].innerText = booleanToIcon(
    deviceManager.supportInput(TelephonyUsage.HOOK_SWITCH)
  );
  hookSwitch.cells[2].innerText = booleanToIcon(
    deviceManager.isInputToggle(TelephonyUsage.HOOK_SWITCH)
  );
  if (deviceManager.supportInput(TelephonyUsage.HOOK_SWITCH)) {
    deviceManager.subscribe(TelephonyUsage.HOOK_SWITCH, (val: boolean) => {
      appendLog(`Received: HookSwitch(${val})`);
    });
  }

  const phoneMute = inputReportTable.rows[2];
  phoneMute.cells[1].innerText = booleanToIcon(
    deviceManager.supportInput(TelephonyUsage.PHONE_MUTE)
  );
  phoneMute.cells[2].innerText = booleanToIcon(
    deviceManager.isInputToggle(TelephonyUsage.PHONE_MUTE)
  );
  if (deviceManager.supportInput(TelephonyUsage.PHONE_MUTE)) {
    deviceManager.subscribe(TelephonyUsage.PHONE_MUTE, (val: boolean) => {
      appendLog(`Received: PhoneMute(${val})`);
    });
  }

  appendLog('Input Event Support:');
  appendLog(
    `    Hook-Switch: ${deviceManager.supportInput(TelephonyUsage.HOOK_SWITCH)}`
  );
  appendLog(
    `    Phone-Mute: ${deviceManager.supportInput(TelephonyUsage.PHONE_MUTE)}`
  );
}

function verifyOutputReport(deviceManager: TelephonyDeviceManager) {
  const outputReportTable = document.getElementById(
    'output-report'
  )! as HTMLTableElement;

  outputReportTable.rows[1].cells[1].innerText = booleanToIcon(
    deviceManager.supportOutput(LedUsage.OFF_HOOK)
  );
  outputReportTable.rows[2].cells[1].innerText = booleanToIcon(
    deviceManager.supportOutput(LedUsage.RING)
  );
  outputReportTable.rows[3].cells[1].innerText = booleanToIcon(
    deviceManager.supportOutput(LedUsage.MUTE)
  );
  outputReportTable.rows[4].cells[1].innerText = booleanToIcon(
    deviceManager.supportOutput(TelephonyUsage.RINGER)
  );

  const outputCtrl = document.getElementById(
    'output-controls'
  )! as HTMLDivElement;

  const controlTable = document.createElement('table') as HTMLTableElement;
  outputCtrl.appendChild(controlTable);
  function insertControls(
    deviceManager: TelephonyDeviceManager,
    title: String,
    usage: OutputUsage
  ) {
    const row = controlTable.insertRow();
    row.innerHTML = `
        <td>${title}</td>
        <td>
          <button>${title}(1)</button>
          <button>${title}(0)</button>
        </td>
      `;
    for (const val of [1, 0]) {
      const btn = row.cells[1].children[1 - val]! as HTMLButtonElement;
      btn.addEventListener('click', () => {
        deviceManager.send(usage, val === 1);
        appendLog(`Send a ${title}(${val}) event`);
      });
    }
  }
  if (deviceManager.supportOutput(LedUsage.OFF_HOOK)) {
    insertControls(deviceManager, 'Off-Hook', LedUsage.OFF_HOOK);
  }
  if (deviceManager.supportOutput(LedUsage.RING)) {
    insertControls(deviceManager, 'Ring', LedUsage.RING);
  }
  if (deviceManager.supportOutput(LedUsage.MUTE)) {
    insertControls(deviceManager, 'Mute', LedUsage.MUTE);
  }
  if (deviceManager.supportOutput(TelephonyUsage.RINGER)) {
    insertControls(deviceManager, 'Ringer', TelephonyUsage.RINGER);
  }
  outputCtrl.hidden = false;

  appendLog('Output Event Support:');
  appendLog(
    `    Led.Off-Hook: ${deviceManager.supportOutput(LedUsage.OFF_HOOK)}`
  );
  appendLog(`    Led.Ring: ${deviceManager.supportOutput(LedUsage.RING)}`);
  appendLog(`    Led.Mute: ${deviceManager.supportOutput(LedUsage.MUTE)}`);
  appendLog(
    `    Telephony.Ringer: ${deviceManager.supportOutput(
      TelephonyUsage.RINGER
    )}`
  );
}

async function ringTestCase(deviceManager: TelephonyDeviceManager) {
  const callStatusIndicator: boolean = await confirmYesNo(
    'Is there a Call Status Indicator?'
  );
  appendLog(`With a call status indicator: ${callStatusIndicator}`);
  if (!callStatusIndicator) {
    return true;
  }

  deviceManager.send(LedUsage.RING, true);
  if (
    !(await confirmYesNo(
      'Does the indicator show a call ringing? \n (Wait for a few seconds)'
    ))
  ) {
    return false;
  }

  deviceManager.send(LedUsage.RING, false);
  if (
    !(await confirmYesNo(
      'Does the indicator change to no call? \n (Wait for a few seconds)'
    ))
  ) {
    return false;
  }
  return true;
}

async function muteTestCase(deviceManager: TelephonyDeviceManager) {
  const statusIndicator: boolean = await confirmYesNo(
    'Is there a microphone status Indicator?'
  );
  appendLog(`With a microphone status indicator: ${statusIndicator}`);
  if (!statusIndicator) {
    return true;
  }

  deviceManager.send(LedUsage.MUTE, true);
  if (
    !(await confirmYesNo(
      'Does the indicator show the microphone is muted? \n (Wait for a few seconds)'
    ))
  ) {
    return false;
  }

  if (
    !(await confirmYesNo(
      'Is the microphone muted? \n (Use another tab to record to verify)'
    ))
  ) {
    return false;
  }

  deviceManager.send(LedUsage.MUTE, false);
  if (
    !(await confirmYesNo(
      'Does the indicator change to not muted? \n (Wait for a few seconds)'
    ))
  ) {
    return false;
  }

  if (
    !(await confirmYesNo(
      'Is the microphone unmuted? \n (Use another tab to record to verify)'
    ))
  ) {
    return false;
  }
  return true;
}

async function offHookTestCase(deviceManager: TelephonyDeviceManager) {
  const callStatusIndicator: boolean = await confirmYesNo(
    'Is there a Call Status Indicator?'
  );
  appendLog(`With a call status indicator: ${callStatusIndicator}`);
  if (!callStatusIndicator) {
    return true;
  }

  deviceManager.send(LedUsage.OFF_HOOK, true);
  if (
    !(await confirmYesNo(
      'Does the indicator show an active call? \n (Wait for a few seconds)'
    ))
  ) {
    return false;
  }

  deviceManager.send(LedUsage.OFF_HOOK, false);
  if (
    !(await confirmYesNo(
      'Does the indicator change to no call? \n (Wait for a few seconds)'
    ))
  ) {
    return false;
  }
  return true;
}

async function hookSwitchTestCase(deviceManager: TelephonyDeviceManager) {
  const waitForHookSwitch: (val: boolean) => void = (val: boolean) => {
    if (val) {
      deviceManager.unsubscribe(TelephonyUsage.HOOK_SWITCH, waitForHookSwitch);
      yesCallback();
    }
  };

  appendLog('Test catch:');
  appendLog('Send Led.OffHook(0)');
  deviceManager.send(LedUsage.OFF_HOOK, false);
  appendLog('Send Led.Ring(1)');
  deviceManager.send(LedUsage.RING, true);
  appendLog('Send Telephony.RINGER(1)');
  deviceManager.send(TelephonyUsage.RINGER, true);
  deviceManager.subscribe(TelephonyUsage.HOOK_SWITCH, waitForHookSwitch);
  if (
    !(await confirmYesNo(
      'Does pressing the button trigger HookSwitch(true)? \n (Press the hook switch button and wait)',
      true
    ))
  ) {
    deviceManager.unsubscribe(TelephonyUsage.HOOK_SWITCH, waitForHookSwitch);
    deviceManager.send(LedUsage.RING, false);
    deviceManager.send(TelephonyUsage.RINGER, false);
    deviceManager.send(LedUsage.OFF_HOOK, false);
    return false;
  }
  deviceManager.send(LedUsage.RING, false);
  deviceManager.send(TelephonyUsage.RINGER, false);

  appendLog('Test hang up:');
  appendLog('Send Led.OffHook(1)');
  deviceManager.send(LedUsage.OFF_HOOK, true);
  const waitForHangUp: (val: boolean) => void = (val: boolean) => {
    if (!val) {
      deviceManager.unsubscribe(TelephonyUsage.HOOK_SWITCH, waitForHangUp);
      yesCallback();
    }
  };

  deviceManager.subscribe(TelephonyUsage.HOOK_SWITCH, waitForHangUp);
  if (
    !(await confirmYesNo(
      'Does pressing the button trigger HookSwitch(false)? \n (Press the hook switch button and wait)',
      true
    ))
  ) {
    deviceManager.send(LedUsage.OFF_HOOK, false);
    deviceManager.unsubscribe(TelephonyUsage.HOOK_SWITCH, waitForHangUp);
    return false;
  }
  appendLog('Send Led.OffHook(0)');
  deviceManager.send(LedUsage.OFF_HOOK, false);
  return true;
}

function verifyTestCasesFeasibility(deviceManager: TelephonyDeviceManager) {
  const outputReportTable = document.getElementById('test-cases')!;
  appendLog('Valid For Test Cases:');
  if (deviceManager.supportInput(TelephonyUsage.HOOK_SWITCH)) {
    const hookSwitchBtn = document.createElement('button') as HTMLButtonElement;
    hookSwitchBtn.onclick = async () => {
      appendLog('==== Start Test Case - Hook Switch ====');
      appendLog(
        `Test result: ${
          (await hookSwitchTestCase(deviceManager)) ? 'Pass' : 'Fail'
        }`
      );
    };
    hookSwitchBtn.innerText = 'Hook Switch';
    outputReportTable.append(hookSwitchBtn);
    appendLog('    Hook Switch');
  }

  if (deviceManager.supportOutput(LedUsage.OFF_HOOK)) {
    const offHookBtn = document.createElement('button') as HTMLButtonElement;
    offHookBtn.onclick = async () => {
      appendLog('==== Start Test Case - Off-Hook ====');
      appendLog(
        `Test result: ${
          (await offHookTestCase(deviceManager)) ? 'Pass' : 'Fail'
        }`
      );
    };
    offHookBtn.innerText = 'Off-Hook';
    outputReportTable.append(offHookBtn);
    appendLog('    Off-Hook');
  }

  if (deviceManager.supportOutput(LedUsage.RING)) {
    const ringBtn = document.createElement('button') as HTMLButtonElement;
    ringBtn.onclick = async () => {
      appendLog('==== Start Test Case - Ring ====');
      appendLog(
        `Test result: ${(await ringTestCase(deviceManager)) ? 'Pass' : 'Fail'}`
      );
    };
    ringBtn.innerText = 'Ring';
    outputReportTable.append(ringBtn);
    appendLog('    Ring');
  }

  if (deviceManager.supportOutput(LedUsage.MUTE)) {
    const muteBtn = document.createElement('button') as HTMLButtonElement;
    muteBtn.onclick = async () => {
      appendLog('==== Start Test Case - Mute ====');
      appendLog(
        `Test result: ${(await muteTestCase(deviceManager)) ? 'Pass' : 'Fail'}`
      );
    };
    muteBtn.innerText = 'Mute';
    outputReportTable.append(muteBtn);
    appendLog('    Mute');
  }

  outputReportTable.hidden = false;
}

async function main() {
  document.getElementById('start')!.onclick = async () => {
    const deviceManager = await TelephonyDeviceManager.create();
    if (deviceManager === null) {
      appendLog('Failed to create the TelephonyDeviceManager');
      return;
    }
    reset();

    appendLog(`DUT name: ${deviceManager.device.productName}`);
    verifyInputReport(deviceManager);
    verifyOutputReport(deviceManager);

    verifyTestCasesFeasibility(deviceManager);
  };

  document.getElementById('clear')!.onclick = clearLog;
  document.getElementById('copy')!.onclick = copyLog;
}

main();
