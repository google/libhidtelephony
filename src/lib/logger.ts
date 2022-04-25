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

/** Logger levels */
export enum Level {
  OFF = 0,
  ERROR,
  INFO,
  DEBUG,
}

/** Logger class used to log different level of logs */
export class Logger {
  /**
   * Constructor logger that only print logs with verbosity
   * that are higher than the speficied level.
   * @param {Levle} level
   */
  constructor(readonly level: Level = Level.INFO) {}

  /**
   * Print info level logs.
   * @param {unknown[]} logs
   */
  info(...logs: unknown[]) {
    if (this.level < Level.INFO) return;
    console.log(...logs);
  }
  /**
   * Print debug level logs.
   * @param {unknown[]} logs
   */
  debug(...logs: unknown[]) {
    if (this.level < Level.DEBUG) return;
    console.log(...logs);
  }

  /**
   * Print error level logs.
   * @param {unknown[]} logs
   */
  error(...logs: unknown[]) {
    if (this.level < Level.ERROR) return;
    console.error(...logs);
  }
}
